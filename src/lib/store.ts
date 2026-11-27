import { createContext, useContext } from "react";
import type { Household, Item, MealLog, Member, MenuEntry, Movement, Purchase, Recipe, RecipeIngredient, Trip } from "./types";

export interface Data {
  userId: string;
  household: Household;
  members: Member[];
  items: Item[];
  purchases: Purchase[];
  trips: Trip[];
  movements: Movement[];
  recipes: Recipe[];
  ingredients: RecipeIngredient[];
  plan: MenuEntry[];
  mealLogs: MealLog[];
  /** Cantidad en despensa por artículo (suma de movimientos) */
  stock: Map<string, number>;
  loading: boolean;
  error: string | null;
  /** Vuelve a leer todo. Se llama después de cada cambio, sin depender del tiempo real. */
  refresh: () => Promise<void>;
  memberName: (userId: string | null) => string;
}

export const DataContext = createContext<Data | null>(null);

export function useData(): Data {
  const v = useContext(DataContext);
  if (!v) throw new Error("useData fuera de DataProvider");
  return v;
}
