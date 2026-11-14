import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { useTable } from "./useTable";
import type { Household, Item, Member, Movement, Purchase, Trip } from "./types";

interface Data {
  userId: string;
  household: Household;
  members: Member[];
  items: Item[];
  purchases: Purchase[];
  trips: Trip[];
  movements: Movement[];
  /** Cantidad en despensa por artículo (suma de movimientos) */
  stock: Map<string, number>;
  loading: boolean;
  error: string | null;
  reloadHousehold: () => Promise<void>;
  memberName: (userId: string | null) => string;
}

const Ctx = createContext<Data | null>(null);

export function useData(): Data {
  const v = useContext(Ctx);
  if (!v) throw new Error("useData fuera de DataProvider");
  return v;
}

export function DataProvider({ userId, household: initial, children }: { userId: string; household: Household; children: ReactNode }) {
  const [household, setHousehold] = useState<Household>(initial);
  const [members, setMembers] = useState<Member[]>([]);
  const items = useTable<Item>("items", initial.id, { column: "sort" });
  const purchases = useTable<Purchase>("purchases", initial.id, { column: "created_at" });
  const trips = useTable<Trip>("shopping_trips", initial.id, { column: "trip_date", ascending: false });
  const movements = useTable<Movement>("stock_movements", initial.id, { column: "created_at" });
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
    stock,
    loading: items.loading || purchases.loading || trips.loading,
    error: items.error || purchases.error || trips.error || movements.error,
    reloadHousehold,
    memberName,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
