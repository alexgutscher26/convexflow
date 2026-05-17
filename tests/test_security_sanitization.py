import pytest
from pydantic import ValidationError
from backend.server import NodeIn, NodeUpdate

def test_node_in_sanitization():
    # 1. Test XSS / Script Tag Stripping
    dangerous_content = "<script>alert('xss')</script>Hello <iframe src='malicious'></iframe>World"
    node = NodeIn(type="Product Overview", title="Test Node", content=dangerous_content)
    assert "<script>" not in node.content
    assert "<iframe>" not in node.content
    assert "Hello World" in node.content

    # 2. Test Inline Event Handler & javascript: URL Stripping
    xss_events = "Click [here](javascript:alert(1)) <img src='x' onerror='alert(2)'>"
    node2 = NodeIn(type="Product Overview", title="XSS Events", content=xss_events)
    assert "javascript:" not in node2.content
    assert "onerror=" not in node2.content

    # 3. Test Unicode Zero-Width character stripping & NFKC Normalization
    # \u200b is a zero-width space
    zalgo_unicode = "Normal\u200bText"
    node3 = NodeIn(type="Product Overview", title="Zalgo", content=zalgo_unicode)
    assert "\u200b" not in node3.content
    assert node3.content == "NormalText"


def test_node_in_length_constraints():
    # Title length constraint (max 120)
    long_title = "A" * 121
    with pytest.raises(ValidationError) as excinfo:
        NodeIn(type="Product Overview", title=long_title, content="Safe content")
    assert "Input exceeds maximum allowed length of 120 characters" in str(excinfo.value)

    # Content length constraint (max 30,000)
    long_content = "B" * 30001
    with pytest.raises(ValidationError) as excinfo2:
        NodeIn(type="Product Overview", title="Safe Title", content=long_content)
    assert "Input exceeds maximum allowed length of 30000 characters" in str(excinfo2.value)


def test_node_update_sanitization_and_optionality():
    # NodeUpdate should allow None (optional fields) without validation errors
    update_empty = NodeUpdate()
    assert update_empty.title is None
    assert update_empty.content is None

    # Test that dangerous strings are sanitized upon update
    dangerous_update = NodeUpdate(content="<script>evil()</script>Clean Content")
    assert "Clean Content" in dangerous_update.content
    assert "<script>" not in dangerous_update.content

    # Test length limits on update
    long_title = "C" * 121
    with pytest.raises(ValidationError):
        NodeUpdate(title=long_title)
