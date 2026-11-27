import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { useTable } from "./useTable";
import { DataContext, type Data } from "./store";
import type { Household, Item, MealLog, Member, MenuEntry, Movement, Purchase, Recipe, RecipeIngredient, Trip } from "./types";

export function DataProvider({ userId, household: initial, children }: { userId: string; household: Household; children: ReactNode }) {
  const [household, setHousehold] = useState<Household>(initial);
  const [members, setMembers] = useState<Member[]>([]);
  const items = useTable<Item>("items", initial.id, "sort");
  const purchases = useTable<Purchase>("purchases", initial.id, "created_at");
  const trips = useTable<Trip>("shopping_trips", initial.id, "trip_date", false);
  const movements = useTable<Movement>("stock_movements", initial.id, "created_at");
  const recipes = useTable<Recipe>("recipes", initial.id, "name");
  const ingredients = useTable<RecipeIngredient>("recipe_ingredients", initial.id, "id");
  const plan = useTable<MenuEntry>("menu_plan", initial.id, "day");
  const mealLogs = useTable<MealLog>("meal_logs", initial.id, "log_date", false);
  const stock = useMemo(() => {
    const m = new Map<string, number>();
    for (const mv of movements.rows) m.set(mv.item_id, (m.get(mv.item_id) ?? 0) + Number(mv.delta));
    return m;
  }, [movements.rows]);

  const reloadHousehold = useCallback(async () => {
    const [{ data: h }, { data: m }] = await Promise.all([
      supabase.from("households").select("*").eq("id", initial.id).single(),
      supabase.from("household_members").select("*").eq("household_id", initial.id),
    ]);
    if (h) setHousehold(h as Household);
    if (m) setMembers(m as Member[]);
  }, [initial.id]);

  useEffect(() => {
    reloadHousehold();
    const ch = supabase
      .channel(`rt-household-${initial.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "households", filter: `id=eq.${initial.id}` }, () => reloadHousehold())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [initial.id, reloadHousehold]);

  const reloadItems = items.reload, reloadPurchases = purchases.reload, reloadTrips = trips.reload, reloadMovements = movements.reload;
  const reloadRecipes = recipes.reload, reloadIngredients = ingredients.reload, reloadPlan = plan.reload, reloadLogs = mealLogs.reload;
  const refresh = useCallback(async () => {
    await Promise.all([reloadItems(), reloadPurchases(), reloadTrips(), reloadMovements(), reloadHousehold(), reloadRecipes(), reloadIngredients(), reloadPlan(), reloadLogs()]);
  }, [reloadItems, reloadPurchases, reloadTrips, reloadMovements, reloadHousehold, reloadRecipes, reloadIngredients, reloadPlan, reloadLogs]);

  const memberName = useCallback(
    (uid: string | null) => members.find((m) => m.user_id === uid)?.display_name ?? "",
    [members],
  );

  const value: Data = {
    userId,
    household,
    members,
    items: items.rows,
    purchases: purchases.rows,
    trips: trips.rows,
    movements: movements.rows,
    recipes: recipes.rows,
    ingredients: ingredients.rows,
    plan: plan.rows,
    mealLogs: mealLogs.rows,
    stock,
    loading: items.loading || purchases.loading || trips.loading || movements.loading || recipes.loading || plan.loading,
    error: items.error || purchases.error || trips.error || movements.error || recipes.error || ingredients.error || plan.error || mealLogs.error,
    refresh,
    memberName,
  };
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
