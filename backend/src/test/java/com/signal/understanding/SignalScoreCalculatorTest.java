package com.signal.understanding;

import com.signal.understanding.service.SignalScoreCalculator;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class SignalScoreCalculatorTest {

    @Test void allHundred() {
        var r = SignalScoreCalculator.score(new SignalScoreCalculator.Factors(100,100,100,100,100,100,100));
        assertEquals(100.0, r.score(), 0.1);
    }

    @Test void allZero() {
        var r = SignalScoreCalculator.score(new SignalScoreCalculator.Factors(0,0,0,0,0,0,0));
        assertEquals(0.0, r.score(), 0.1);
    }

    @Test void mixedIsDeterministic() {
        var f = new SignalScoreCalculator.Factors(94,90,88,80,85,92,95);
        assertEquals(SignalScoreCalculator.score(f).score(),
                     SignalScoreCalculator.score(f).score(), 0.001);
    }

    @Test void factorsExposed() {
        var r = SignalScoreCalculator.score(new SignalScoreCalculator.Factors(94,90,88,80,85,92,95));
        assertEquals(94.0, r.factors().get("relevance"), 0.001);
    }
}
