# Phase 0 Bug Report: Critical Issues Preventing Completion

**Status**: NOT READY FOR PRODUCTION
**Date**: 2026-03-26
**Impact**: Core backtesting results are unreliable

---

## Executive Summary

Phase 0 is **structurally incomplete** with several critical bugs that invalidate backtest results:

1. **Only Aggressive personality executes trades** — Conservative and Balanced personalities never fire
2. **ESLint configuration missing** — `npm run lint` fails
3. **Stop-loss logic may be ineffective** — Average loss of ₹-6 suggests trades aren't being closed properly
4. **Time window incompatibilities** — Signal generation and personality windows don't align
5. **Missing profit-gate enforcement** — Conservative personality's profit gate is not implemented
6. **Momentum exhaustion may not fire** — Only Aggressive is catching signals

---

## Bug Details

### 1. **CRITICAL: Time Window Mismatch — Why Only Aggressive Trades**

#### Root Cause
The signal generation and personality configuration have incompatible time windows:

**Signal Generation** (`src/signals/signalGenerator.ts:86`):
```typescript
if (time === '09:17') {
  const prob = applyAdjustments(0.50, current, regime, dte);
  // ...trigger scheduled entry
}
```

**Personality Windows** (`src/config/personalities.ts`):
- **Conservative**: `09:25-11:30` and `14:00-15:00`
- **Balanced**: `09:20-15:15`
- **Aggressive**: `09:15-15:25`

**The Problem**:
- At 09:17, a signal fires
- Conservative window starts at 09:25 → signal at 09:17 is rejected (not in window)
- Balanced window starts at 09:20 → signal at 09:17 is rejected (09:17 < 09:20)
- **Only Aggressive window starts at 09:15** → 09:17 signal is accepted ✓

#### Why This Happens
The filter in `src/backtesting/engine.ts:78-83`:
```typescript
const inWindow = personality.allowedTradingWindows.some(
  (w) => timeStr >= w.startTime && timeStr <= w.endTime
);
if (!inWindow) return false;
```

At 09:17, only `09:15-15:25` (Aggressive) satisfies `'09:17' >= '09:15'`.

#### Impact
- **Backtest Results Are Fake**: All 524 trades are Aggressive only
- Conservative personality produces 0 trades (doesn't enter window until 09:25)
- Balanced personality produces 0 trades (window starts at 09:20, which is after 09:17)
- No multi-personality comparison possible

#### Success Criteria NOT Met
- ✗ "Each personality produces statistically meaningful trade count (≥10 trades)"
- ✗ "By-personality breakdown shows all 3 personalities active"

---

### 2. **CRITICAL: ESLint Configuration Missing**

#### Root Cause
`npm run lint` fails because `.eslintrc.json` or equivalent config file doesn't exist:

```
ESLint couldn't find a configuration file. To set up a configuration file
for this project, please run:
    npm init @eslint/config
```

#### Impact
- ✗ `npm run lint` command fails (exit code 1)
- Cannot validate code quality
- CI/CD pipeline blocks on lint failure

#### Success Criteria NOT Met
- ✗ "`npm run lint` passes with no errors"

---

### 3. **HIGH: Stop-Loss Logic Broken — Avg Loss ₹-6**

#### Root Cause
The average loss of ₹-6 is essentially zero, which is unrealistic. This suggests:

**Hypothesis**: The stop-loss mechanism in `src/backtesting/engine.ts:114-133` may not be triggering:

```typescript
for (let i = entryIdx + 1; i < dayData.snapshots.length; i++) {
  const snap = dayData.snapshots[i];
  const pnlPct = (snap.straddleValue - entryPrice) / entryPrice;

  // For STRADDLE_SELL: adverse move is premium increasing
  if (signal.signalType === 'STRADDLE_SELL' && pnlPct > 0.15) {
    exitPrice = applySlippage(snap.straddleValue, config, false);
    exitReason = 'stoploss';
    exitTime = snap.timestamp;
    break;
  }
```

**Possible Issues**:
- Stop-loss at +15% is too tight or never triggered by mock data
- EOD exit doesn't apply slippage correctly (sell at EOD price)
- Trades that "lose money" are not truly losing money, just smaller wins
- Mock data might be unrealistically favorable

#### Impact
- ✗ Loss tracking is unrealistic
- ✗ Win rate of 90.5% is not credible
- ✗ Risk management validation impossible

#### Success Criteria NOT Met
- ✗ "Average loss is negative (realistic stop-loss execution)"
- ✗ "Win rate is between 40-60% (realistic expectation)"

---

### 4. **MEDIUM: Profit-Gate Logic Not Implemented**

#### Root Cause
Conservative personality has:
```typescript
requireProfitGate: true,
profitGateThreshold: 5000,
profitGateLookbackDays: 5,
```

But the backtesting engine (`src/backtesting/engine.ts`) **does not check** this condition. The `personalityAllows()` function at line 64 never validates profit gate.

#### Impact
- ✗ Conservative personality doesn't enforce its risk rule (no trades on days after -₹5000 loss)
- Feature is defined but not implemented

#### Success Criteria NOT Met
- ✗ "Conservative personality enforces profit-gate check on trading days"

---

### 5. **MEDIUM: Momentum Exhaustion Signal May Not Fire**

#### Root Cause
All 524 trades land in the "9:20" bucket, but momentum exhaustion window is `09:20-11:00` with a 10% expansion requirement:

```typescript
if (
  isInWindow(ts, '09:20', '11:00') &&
  current.straddleChangeFromOpen > 10 &&
  detectMomentumExhaustion(history, 0.5)
) { ... }
```

**Issue**: If momentum exhaustion only fires after expansion occurs (usually 30+ min into session), the rule may never trigger in practice. Need to verify `detectMomentumExhaustion()` logic.

#### Impact
- ✗ Most signals likely come from 09:17 scheduled entry, not momentum detection
- ✗ Momentum-based strategy is not being tested

---

### 6. **LOW: Missing Dependencies Not Installed**

#### Root Cause
`node_modules` directory doesn't exist. `npm install` was never run or node_modules was .gitignored (correctly).

#### Impact
- First-time cloner gets confusing build errors
- Minor, but affects onboarding

#### Success Criteria NOT Met
- ✗ "Fresh clone can run `npm install && npm run test` without setup"

---

## Backtesting Output Analysis (Unrealistic Metrics)

Current output shows:

```
Total trades    : 524
Win rate        : 90.5%  (474W / 50L)
Avg win         : ₹7,044
Avg loss        : ₹-6           ← UNREALISTIC
Max drawdown    : 0.00%          ← IMPOSSIBLE
Sharpe ratio    : 27.29          ← UNREALISTIC (normal range 0.5–3)
Profit factor   : 10606.444      ← UNREALISTIC

BY PERSONALITY ─────────────────────────────────────────
Aggressive     524     90.5%     ₹33,38,382   27.29
Conservative   0       N/A       N/A          N/A     ← ZERO TRADES
Balanced       0       N/A       N/A          N/A     ← ZERO TRADES
```

**Interpretation**:
- The backtest is only testing Aggressive personality
- Conservative and Balanced personalities never get to trade
- Results are not representative of the system

---

## Success Criteria Checklist (Phase 0)

- [x] TypeScript compiles cleanly: `npm run build` → OK
- [x] Tests pass: `npm run test` → 39/39 pass
- [ ] Lint passes: `npm run lint` → **FAIL** (no config)
- [ ] Backtest runs without error: `npm run backtest` → OK (but results unreliable)
- [ ] All 3 personalities execute trades → **FAIL** (only Aggressive)
- [ ] Each personality produces ≥10 trades → **FAIL**
- [ ] Stop-loss triggers (avg loss < 0) → **FAIL** (avg loss ₹-6)
- [ ] Win rate is 40-60% (realistic) → **FAIL** (90.5%)
- [ ] Max drawdown shows risk periods → **FAIL** (0.00%)
- [ ] 9:17 and momentum signals both fire → **UNCERTAIN** (need investigation)
- [ ] Profit-gate enforced for Conservative → **FAIL** (not implemented)

**Overall Phase 0 Status**: ❌ **NOT COMPLETE** (7 critical/high failures)

---

## Recommended Fixes (Priority Order)

### P0 (Must Fix Before Phase 1)
1. **Fix time window incompatibility**: Adjust personality windows to match signal times
2. **Add ESLint config**: Create `.eslintrc.json`
3. **Implement profit-gate check**: Add logic in `personalityAllows()`
4. **Validate stop-loss**: Check mock data realism and SL trigger logic

### P1 (Should Fix Before Release)
5. Investigate momentum exhaustion firing
6. Add integration tests for personality filtering
7. Document backtesting assumptions

### P2 (Nice to Have)
8. Commit node_modules or improve .gitignore docs
9. Add validation test for "all personalities can trade"

---

## Next Steps

1. **Create GitHub issue** for time window mismatch (P0)
2. **Create GitHub issue** for ESLint config (P0)
3. **Create GitHub issue** for profit-gate implementation (P0)
4. **Add integration tests** to catch these in future
5. **Re-run backtest** after fixes to verify realistic results
