Excellent question! Thinking about the hook's "contract" or API is the most important step. A well-designed hook is intuitive, reusable, and easy to test.

Let's break down the needs of a component that uses this hook. A typical chat UI needs to:

1.  **Display** the conversation history (the list of messages).
2.  **Update** as the user types a new message into an input field.
3.  **Perform an action** when the user submits the new message.

Given these three core requirements, what pieces of state and what functions do you think our `useChat` hook should provide back to the component?