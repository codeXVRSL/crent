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
  return query
    select w::date,
           coalesce((select sum(p.amount_cents) from payments p
                      where p.status in ('paid','partially_refunded','refunded') and p.currency = v_cur
                        and date_trunc('week', p.paid_at at time zone 'Asia/Manila')::date = w::date), 0)::bigint,
           (select count(*) from unlocks u
             where u.status <> 'reversed' and date_trunc('week', u.created_at at time zone 'Asia/Manila')::date = w::date)::int,
           v_cur
      from generate_series(v_first, date_trunc('week', now() at time zone 'Asia/Manila')::date, interval '7 days') w
     order by 1;
end $$;
revoke execute on function admin_weekly_trends(int) from public, anon;
grant execute on function admin_weekly_trends(int) to authenticated;
