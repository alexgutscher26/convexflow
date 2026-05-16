class LlmChat:
    def __init__(self, *args, **kwargs):
        pass
    def with_model(self, *args, **kwargs):
        return self
    async def send_message(self, *args, **kwargs):
        return "AI is currently in mock mode because the emergentintegrations package was not found."

class UserMessage:
    def __init__(self, text, *args, **kwargs):
        self.text = text
