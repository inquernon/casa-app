import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

const PAGE = 1000;

/** Lee todas las filas del hogar en una tabla y las mantiene al día con Supabase Realtime. */
export function useTable<T>(table: string, householdId: string, order?: { column: string; ascending?: boolean }) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const all: T[] = [];
    for (let from = 0; ; from += PAGE) {
      let q = supabase.from(table).select("*").eq("household_id", householdId).range(from, from + PAGE - 1);
      if (order) q = q.order(order.column, { ascending: order.ascending ?? true });
      const { data, error: err } = await q;
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      all.push(...((data ?? []) as T[]));
      if (!data || data.length < PAGE) break;
    }
    setRows(all);
    setError(null);
    setLoading(false);
  }, [table, householdId, order?.column, order?.ascending]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`rt-${table}-${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table, filter: `household_id=eq.${householdId}` }, () => {
        load();
      })
      .subscribe();
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [load, table, householdId]);

  return { rows, loading, error, reload: load };
}
