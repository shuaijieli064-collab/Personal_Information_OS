-- Signal scores have exactly one scale: 0–100 (SignalScoreCalculator.MAX_SCORE).
-- Demo data and a few Phase-5 rows were written on a 0–1 scale, which made the same
-- column carry two units: a 0.96 demo signal rendered as an almost-empty score ring,
-- and a genuine 75.3 outranked it in every "top signals" query.
--
-- Rows at or below 1 can only be the 0–1 scale — a real 0–100 score that low is
-- below every threshold the product ships with (app.signal.min-score defaults to 70)
-- and could never have been persisted as a signal. Rescale them once, then let a
-- CHECK constraint make the mixed-scale bug impossible to reintroduce.
UPDATE signals
   SET signal_score = ROUND((signal_score * 100)::numeric, 1)
 WHERE signal_score IS NOT NULL
   AND signal_score <= 1;

UPDATE information_understanding
   SET signal_score = ROUND((signal_score * 100)::numeric, 1)
 WHERE signal_score IS NOT NULL
   AND signal_score <= 1;

ALTER TABLE signals
  ADD CONSTRAINT signals_signal_score_range
  CHECK (signal_score IS NULL OR (signal_score >= 0 AND signal_score <= 100));

ALTER TABLE information_understanding
  ADD CONSTRAINT understanding_signal_score_range
  CHECK (signal_score IS NULL OR (signal_score >= 0 AND signal_score <= 100));

-- "Why it matters" used to be built from an English keyword template
-- ("Matches your goal: X", "Not clearly matched to your current context.").
-- That is machine text, not a translation of anything, and it leaked English into
-- every non-English interface. The field is now filled by the model and left empty
-- when it cannot be — the UI hides an absent reason rather than showing English.
UPDATE signals
   SET why_it_matters = NULL
 WHERE why_it_matters LIKE 'Matches your %'
    OR why_it_matters LIKE 'Not clearly matched%';

UPDATE information_understanding
   SET why_relevant = NULL
 WHERE why_relevant LIKE 'Matches your %'
    OR why_relevant LIKE 'Not clearly matched%';
