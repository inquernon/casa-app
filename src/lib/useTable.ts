import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

const PAGE = 1000;

/** Lee todas las filas del hogar en una tabla y las mantiene al día con Supabase Realtime. */
export function useTable<T>(table: string, householdId: string, orderColumn: string, ascending = true) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const all: T[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error: err } = await supabase
        .from(table)
        .select("*")
        .eq("household_id", householdId)
        .order(orderColumn, { ascending })
        .range(from, from + PAGE - 1);
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
  }, [table, householdId, orderColumn, ascending]);

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
