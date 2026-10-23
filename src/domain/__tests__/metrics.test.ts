import { ageFrom, bmi, calorieTarget, defaultPaceKg, mifflinStJeor, movingAverage, navyBodyFat, proteinTarget, tdee } from '../metrics';
import { displayWeight, lbToKg, storeWeight } from '../units';

describe('metrics', () => {
  it('BMI', () => {
    expect(bmi(80, 180).value).toBeCloseTo(24.69, 2);
  });

  it('Navy body fat, male (hand-computed)', () => {
    // 495 / (1.0324 − 0.32411 + 0.34858) − 450 = 18.37
    expect(navyBodyFat('male', 180, 90, 40)!.value).toBeCloseTo(18.37, 1);
  });

  it('Navy body fat, female needs hip', () => {
    expect(navyBodyFat('female', 165, 75, 33)).toBeNull();
    expect(navyBodyFat('female', 165, 75, 33, 100)!.value).toBeCloseTo(29.43, 1);
  });

  it('Navy rejects impossible circumferences', () => {
    expect(navyBodyFat('male', 180, 40, 40)).toBeNull();
  });

  it('Mifflin-St Jeor', () => {
    expect(mifflinStJeor('male', 80, 180, 30).value).toBe(1780);
    expect(mifflinStJeor('female', 60, 165, 30).value).toBeCloseTo(1320.25, 2);
  });

  it('TDEE and calorie target', () => {
    expect(tdee(1780, 1.55).value).toBeCloseTo(2759, 0);
    expect(calorieTarget(2759, -0.5).value).toBe(2759 - 550);
    // Any pace is accepted, including extreme ones.
    expect(calorieTarget(2000, -2).value).toBe(2000 - 2200);
  });

  it('default pace scales with bodyweight', () => {
    expect(defaultPaceKg('lose_fat', 100)).toBeCloseTo(-0.7, 6);
    expect(defaultPaceKg('lose_fat', 50)).toBeCloseTo(-0.35, 6);
    expect(defaultPaceKg('gain_muscle', null)).toBeCloseTo(0.188, 6);
    expect(defaultPaceKg('maintain', 80)).toBe(0);
  });

  it('protein target', () => {
    expect(proteinTarget(80, 'gain_muscle').value).toBe(160);
  });

  it('age', () => {
    expect(ageFrom('2000-06-15', new Date(2026, 5, 14))).toBe(25);
    expect(ageFrom('2000-06-15', new Date(2026, 5, 15))).toBe(26);
  });

  it('moving average', () => {
    expect(movingAverage([1, 2, 3, 4], 2)).toEqual([1, 1.5, 2.5, 3.5]);
    expect(movingAverage([], 7)).toEqual([]);
  });

  it('unit round trip', () => {
    expect(displayWeight(storeWeight(225, 'imperial'), 'imperial')).toBe(225);
    expect(lbToKg(220.46226218)).toBeCloseTo(100, 6);
  });
});
