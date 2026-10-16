import foods from '../../data/foods.json';
import { matchFoods } from '../matcher';

const all = (foods as unknown as [number, string][]).map(([id, name]) => ({ id, name }));
const top = (q: string) => matchFoods(q, all, 1)[0]?.food.name;

it('maps everyday foods to the plain USDA entry', () => {
  expect(top('eggs')).toBe('Egg, whole, raw, fresh');
  expect(top('milk')).toMatch(/^Milk, whole/);
  expect(top('rice')).toMatch(/^Rice, white/);
  expect(top('oats')).toMatch(/^Cereals, oats/);
  expect(top('salmon')).toMatch(/^Fish, salmon, Atlantic/);
  expect(top('chicken breast')).toMatch(/^Chicken, broilers or fryers, breast/);
  expect(top('potatoes')).toMatch(/^Potatoes, boiled/);
  expect(top('dried egg')).toMatch(/dried/i);
});
