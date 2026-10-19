-- Outlier Desk — a researcher's earnings per Manila week, for the dashboard chart. Own rows only.
create or replace function my_weekly_earnings(p_weeks int default 12)
returns table (week_start date, earned_cents bigint, currency text)
language plpgsql stable security invoker set search_path = public as $$
declare v_first date; v_cur text;
begin
  v_first := date_trunc('week', now() at time zone 'Asia/Manila')::date - 7 * (least(greatest(p_weeks, 1), 52) - 1);
  select coalesce((select u.currency from unlocks u where u.cre_id = auth.uid() limit 1), 'USD') into v_cur;
  return query
    with weeks as (
      select w::date as wk from generate_series(v_first, date_trunc('week', now() at time zone 'Asia/Manila')::date, interval '7 days') w
    ), earned as (
      select date_trunc('week', u.created_at at time zone 'Asia/Manila')::date as wk, sum(u.net_cents) as cents
        from unlocks u
       where u.cre_id = auth.uid() and u.status <> 'reversed' and u.created_at >= v_first::timestamp at time zone 'Asia/Manila'
       group by 1
    )
    select weeks.wk, coalesce(earned.cents, 0)::bigint, v_cur from weeks left join earned using (wk) order by 1;
end $$;
revoke execute on function my_weekly_earnings(int) from public, anon;
grant execute on function my_weekly_earnings(int) to authenticated;
