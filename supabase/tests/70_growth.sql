-- Growth automations: chat waitlist signups, welcome emails, nudge contacts.
\set ON_ERROR_STOP 1
\set QUIET 1
-- The chat assistant can add a visitor to the waitlist, only as a chat signup.
set role n8n_admin_test;
insert into waitlist(email, side, source) values ('visitor@example.com', 'creator', 'chat');
do $$ begin insert into waitlist(email, side, source) values ('sneaky@example.com', 'creator', 'site'); raise exception 'expected error';
exception when insufficient_privilege then null; end $$;
do $$ begin insert into waitlist(email, side, source) values ('not-an-email', 'creator', 'chat'); raise exception 'expected error';
exception when check_violation then null; end $$;
-- It can mark the welcome as sent, but can't change emails or delete anyone.
update waitlist set welcomed_at = now() where email = 'visitor@example.com';
do $$ begin update waitlist set email = 'x@example.com' where email = 'visitor@example.com'; raise exception 'expected error';
exception when insufficient_privilege then null; end $$;
do $$ begin delete from waitlist; raise exception 'expected error';
exception when insufficient_privilege then null; end $$;
select count(*) > 0 as ok from automation_user_contacts \gset
reset role;
\if :ok \else \echo 'FAIL: n8n role cannot read user contacts' \quit \endif
-- Website visitors and signed-in users can't read login emails.
set role anon;
do $$ begin perform 1 from automation_user_contacts; raise exception 'expected error';
exception when insufficient_privilege then null; end $$;
reset role;
set role authenticated;
do $$ begin perform 1 from automation_user_contacts; raise exception 'expected error';
exception when insufficient_privilege then null; end $$;
reset role;
\echo '✓ growth: chat can join the waitlist (chat only), welcome is marked once, login emails stay private'
