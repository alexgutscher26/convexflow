import React from "react";
import ReactMarkdown from "react-markdown";
import FilePreview from "@/components/canvas/FilePreview";

// Strict HTML tag stripping for raw tags that might sneak through in custom components
const DISALLOWED_TAGS = ["script", "iframe", "object", "embed", "style", "noscript", "meta", "link", "svg"];

// Helper to pre-process markdown and replace @path/to/file references with markdown links using file-preview:// scheme
function preprocessMarkdown(text, fileTree) {
  if (!text || typeof text !== "string") return text;
  
  // Extract all valid repository file paths into a Set for fast lookup
  const filePaths = new Set((fileTree || []).map((f) => f.path));

  // Split content by code blocks (```) and inline code (`) so we don't modify mentions inside them
  const parts = text.split(/(```[\s\S]*?```|`[^`\n]+`)/g);

  const processed = parts.map((part) => {
    // If it's a code block or inline code, return it untouched
    if (part.startsWith("`")) return part;

    // Replace @path/to/file syntax
    return part.replace(/(?:^|\s)@([a-zA-Z0-9_\-\./]+)/g, (match, path) => {
      // Strip trailing punctuation (like periods, commas, question marks) from path
      let cleanPath = path;
      let trailingPunctuation = "";
      const matchPunc = path.match(/([\.\,\?\!\;\:]+)$/);
      if (matchPunc) {
        trailingPunctuation = matchPunc[0];
        cleanPath = path.substring(0, path.length - trailingPunctuation.length);
      }

      // Check if it's a valid file path in the scanned repository tree
      const isValidFile = filePaths.has(cleanPath);

      if (isValidFile || (!fileTree && cleanPath.includes("."))) {
        // Keep the leading space if the regex matched one
        const leadingSpace = match.startsWith(" ") ? " " : "";
        return `${leadingSpace}[@${cleanPath}](file-preview://${cleanPath})${trailingPunctuation}`;
      }
      return match;
    });
  });

  return processed.join("");
}

export default function SafeMarkdown({ children, projectId, fileTree, ...props }) {
  const processedChildren = React.useMemo(() => {
    return preprocessMarkdown(children, fileTree);
  }, [children, fileTree]);

  const components = React.useMemo(() => ({
    a: ({ href, children: linkChildren, ...linkProps }) => {
      if (href && href.startsWith("file-preview://")) {
        const filePath = href.replace("file-preview://", "");
        return <FilePreview path={filePath} projectId={projectId} />;
      }

      // Only allow http://, https://, relative path "/", or anchor links "#" to prevent javascript: XSS
      const isSafe = href && (
        href.startsWith("http://") || 
        href.startsWith("https://") || 
        href.startsWith("/") || 
        href.startsWith("#")
      );
      return (
        <a 
          href={isSafe ? href : "#"} 
          target={isSafe && href.startsWith("http") ? "_blank" : undefined} 
          rel={isSafe && href.startsWith("http") ? "noopener noreferrer" : undefined} 
          {...linkProps}
        >
          {linkChildren}
        </a>
      );
    },
    img: ({ src, ...imgProps }) => {
      // Only allow http://, https://, relative path "/", or safe base64 images to prevent XSS
      const isSafe = src && (
        src.startsWith("http://") || 
        src.startsWith("https://") || 
        src.startsWith("data:image/") ||
        src.startsWith("/")
      );
      if (!isSafe) return null;
      return <img src={src} alt={imgProps.alt || ""} {...imgProps} />;
    }
  }), [projectId]);

  return (
    <ReactMarkdown
      components={components}
      disallowedElements={DISALLOWED_TAGS}
      unwrapDisallowed={true}
      {...props}
    >
      {processedChildren}
    </ReactMarkdown>
  );
}

