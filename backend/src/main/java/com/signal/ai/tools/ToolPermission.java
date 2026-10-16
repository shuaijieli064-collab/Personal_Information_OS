package com.signal.ai.tools;

/**
 * How much autonomy a tool needs from the caller.
 *
 * <p>{@link #READ} tools run unattended. {@link #WRITE} and {@link #DESTRUCTIVE} tools
 * change state, so the agent runtime never runs them on its own — it pauses the run and
 * waits for an explicit confirmation.
 */
public enum ToolPermission { READ, WRITE, DESTRUCTIVE }
