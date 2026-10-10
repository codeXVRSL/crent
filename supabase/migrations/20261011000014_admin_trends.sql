-- Outlier Desk — weekly trends for the admin Overview charts, counted in the database so the totals
-- never depend on how many rows an API call may return. Manila weeks, Monday start.

create or replace function admin_weekly_trends(p_weeks int default 12)
returns table (week_start date, funded_cents bigint, unlocks int, currency text)
language plpgsql stable security definer set search_path = public as $$
declare v_cur text; v_first date;
begin
  if not is_admin() then raise exception 'NOT_ADMIN'; end if;
  select default_currency into v_cur from platform_settings where id;
  v_first := date_trunc('week', now() at time zone 'Asia/Manila')::date - 7 * (least(greatest(p_weeks, 1), 52) - 1);
  -- One pass over each table, limited to the date range, then grouped by Manila week.
  return query
    with weeks as (
      select w::date as wk from generate_series(v_first, date_trunc('week', now() at time zone 'Asia/Manila')::date, interval '7 days') w
    ), paid as (
      select date_trunc('week', p.paid_at at time zone 'Asia/Manila')::date as wk, sum(p.amount_cents) as cents
        from payments p
       where p.status in ('paid','partially_refunded','refunded') and p.currency = v_cur
         and p.paid_at >= v_first::timestamp at time zone 'Asia/Manila'
       group by 1
    ), unl as (
      select date_trunc('week', u.created_at at time zone 'Asia/Manila')::date as wk, count(*) as n
        from unlocks u
       where u.status <> 'reversed' and u.created_at >= v_first::timestamp at time zone 'Asia/Manila'
       group by 1
    )
    select weeks.wk, coalesce(paid.cents, 0)::bigint, coalesce(unl.n, 0)::int, v_cur
      from weeks left join paid using (wk) left join unl using (wk)
     order by 1;
end $$;
revoke execute on function admin_weekly_trends(int) from public, anon;
grant execute on function admin_weekly_trends(int) to authenticated;
