package com.boardsesh.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class OfflineFallbackStateMachineTest {
    @Test
    public void firstFailureAttemptsCache_secondFailureShowsOfflineFlow() {
        OfflineFallbackStateMachine state = new OfflineFallbackStateMachine();

        state.onPageStarted();
        state.onMainFrameError("https://boardsesh.com");
        state.onPageFinished();

        assertTrue(state.shouldAttemptCacheFallback());
        assertFalse(state.shouldAttemptCacheFallback());
        assertEquals("https://boardsesh.com", state.getLastFailedUrl());
    }

    @Test
    public void successfulFinishResetsAttemptAndFailedUrl() {
        OfflineFallbackStateMachine state = new OfflineFallbackStateMachine();

        state.onPageStarted();
        state.onMainFrameError("https://boardsesh.com/foo");
        state.onPageFinished();
        assertTrue(state.shouldAttemptCacheFallback());

        state.onPageStarted();
        state.onPageFinished();

        assertTrue(state.shouldAttemptCacheFallback());
        assertNull(state.getLastFailedUrl());
    }
}
