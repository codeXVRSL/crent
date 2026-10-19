-- Outlier Desk — a researcher's earnings per Manila week, for the dashboard chart. Own rows only.

-- The last N Manila weeks (Monday starts), ending with the current one.
create or replace function manila_weeks(p_weeks int default 12)
returns table (week_start date) language sql stable set search_path = public as $$
  select w::date
    from generate_series(date_trunc('week', now() at time zone 'Asia/Manila')::date - 7 * (least(greatest(p_weeks, 1), 52) - 1),
                         date_trunc('week', now() at time zone 'Asia/Manila')::date, interval '7 days') w
$$;
grant execute on function manila_weeks(int) to authenticated, service_role;

create or replace function my_weekly_earnings(p_weeks int default 12)
returns table (week_start date, earned_cents bigint, currency text)
language plpgsql stable security invoker set search_path = public as $$
declare v_first date; v_cur text;
begin
  select min(mw.week_start) into v_first from manila_weeks(p_weeks) mw;
  -- One currency per chart: the one the researcher was first paid in (briefs pay in the platform currency).
  select coalesce((select u.currency from unlocks u where u.cre_id = auth.uid() order by u.created_at limit 1), 'USD') into v_cur;
  return query
    with weeks as (select mw.week_start from manila_weeks(p_weeks) mw), earned as (
      select date_trunc('week', u.created_at at time zone 'Asia/Manila')::date as wk, sum(u.net_cents) as cents
        from unlocks u
       where u.cre_id = auth.uid() and u.status <> 'reversed' and u.currency = v_cur
         and u.created_at >= v_first::timestamp at time zone 'Asia/Manila'
       group by 1
    )
    select weeks.week_start, coalesce(earned.cents, 0)::bigint, v_cur
      from weeks left join earned on earned.wk = weeks.week_start order by 1;
end $$;
revoke execute on function my_weekly_earnings(int) from public, anon;
grant execute on function my_weekly_earnings(int) to authenticated;
