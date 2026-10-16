package com.signal.ai.tools;

/** The tool cannot run: unknown tool, missing required argument, or a bad argument type. */
public class ToolInvocationException extends RuntimeException {

    public ToolInvocationException(String message) {
        super(message);
    }

    public ToolInvocationException(String message, Throwable cause) {
        super(message, cause);
    }
}
