-- Team seats: read-only teammates on a creator's idea board. Reuses c6 from 60 plus fresh users.
\set ON_ERROR_STOP 1
\set QUIET 1
\set c6 '00000000-0000-0000-0000-0000000000c6'
\set c7 '00000000-0000-0000-0000-0000000000c7'
\set t1 '00000000-0000-0000-0000-0000000000f1'
\set t2 '00000000-0000-0000-0000-0000000000f2'

insert into auth.users(id, email) values (:'t1','Teammate1@Example.com'), (:'t2','t2@example.com');
update profiles set role = 'creator' where id in (:'t1', :'t2');

-- An unlocked idea on c6's board (reuses a researcher from earlier tests).
select p.id as pid from pitches p join briefs b on b.id = p.brief_id where p.status = 'submitted' and b.status = 'open' limit 1 \gset
select creator_id as owner from briefs where id = (select brief_id from pitches where id = :'pid') \gset
select set_config('request.jwt.claim.sub', :'owner', false); set role authenticated;
select unlock_pitch(:'pid');
reset role;

select set_config('request.jwt.claim.sub', :'owner', false); set role authenticated;
do $$ begin perform invite_teammate('not-an-email'); raise exception 'FAIL: bad email';
exception when others then if sqlerrm <> 'TEAM_EMAIL_INVALID' then raise; end if; end $$;
select invite_teammate('  teammate1@example.COM ') as tok \gset
select invite_teammate('teammate1@example.com') = :'tok'::uuid as same \gset
select case when :'same' = 't' and (select count(*) from team_invites) = 1 then '✓ inviting the same email twice keeps one invite' else 'FAIL: duplicate invites' end;
select set_config('my.tok', :'tok', false) \gset
reset role;

-- Only the invited email can accept.
select set_config('request.jwt.claim.sub', :'t2', false); set role authenticated;
do $$ begin perform accept_team_invite(current_setting('my.tok')::uuid); raise exception 'FAIL: other email accepted';
exception when others then if sqlerrm <> 'TEAM_INVITE_OTHER_EMAIL' then raise; end if; end $$;
\echo '✓ an invite only works for the email it was sent to'
reset role;
select set_config('my.owner', :'owner', false) \gset
select set_config('request.jwt.claim.sub', :'t2', false); set role authenticated;
do $$ begin perform * from team_idea_board(current_setting('my.owner')::uuid); raise exception 'FAIL: outsider read the board';
exception when others then if sqlerrm <> 'TEAM_MEMBER_NOT_FOUND' then raise; end if; end $$;
\echo '✓ people outside the team cannot read the board'
reset role;

select set_config('request.jwt.claim.sub', :'t1', false); set role authenticated;
select accept_team_invite(:'tok') = :'owner'::uuid as joined \gset
select case when :'joined' = 't' and (select count(*) from team_idea_board(:'owner')) >= 1
             and (select count(*) from team_idea_board(:'owner') where hook_text is not null) >= 1
  then '✓ a teammate who accepted sees the board with the unlocked hooks' else 'FAIL: teammate board' end;
select case when (select count(*) from teams_i_am_on()) = 1 then '✓ the teammate sees which boards they are on' else 'FAIL: teams_i_am_on' end;
do $$ begin perform accept_team_invite(current_setting('my.tok')::uuid); raise exception 'FAIL: reused invite';
exception when others then if sqlerrm <> 'TEAM_INVITE_INVALID' then raise; end if; end $$;
\echo '✓ an invite works once'
-- Read-only: nothing on the owner's board can be changed or read directly.
select case when (select count(*) from idea_tracking where creator_id = :'owner') = 0
             and (select count(*) from unlocks where creator_id = :'owner') = 0
  then '✓ teammates get no direct access to the owner''s tables' else 'FAIL: direct access' end;
do $$ begin perform save_idea_tracking((select unlock_id from team_idea_board(current_setting('my.owner')::uuid) limit 1), 'filming', null, null, null, null, null, null, null);
  raise exception 'FAIL: teammate edited the board';
exception when others then if sqlerrm like 'FAIL%' then raise; end if; end $$;
\echo '✓ teammates cannot change the board'
reset role;
select case when exists (select 1 from notifications where user_id = :'owner' and kind = 'team_joined') then '✓ the owner is told a teammate joined' else 'FAIL: no notice' end;

-- Owner view, seat limit, remove.
select set_config('request.jwt.claim.sub', :'owner', false); set role authenticated;
select case when (select count(*) from my_team() where kind = 'member' and email = 'Teammate1@Example.com') = 1 then '✓ the owner sees their teammate' else 'FAIL: my_team' end;
select invite_teammate('a' || g || '@example.com') from generate_series(1, 4) g;
do $$ begin perform invite_teammate('one-too-many@example.com'); raise exception 'FAIL: sixth seat';
exception when others then if sqlerrm <> 'TEAM_FULL' then raise; end if; end $$;
\echo '✓ up to 5 seats, counting invites still waiting'
select remove_teammate(:'t1');
reset role;
select set_config('request.jwt.claim.sub', :'t1', false); set role authenticated;
do $$ begin perform * from team_idea_board(current_setting('my.owner')::uuid); raise exception 'FAIL: removed teammate still reads';
exception when others then if sqlerrm <> 'TEAM_MEMBER_NOT_FOUND' then raise; end if; end $$;
\echo '✓ a removed teammate loses access straight away'
reset role;
-- Researchers can't invite.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false); set role authenticated;
do $$ begin perform invite_teammate('x@example.com'); raise exception 'FAIL: researcher invited';
exception when others then if sqlerrm <> 'NOT_CREATOR' then raise; end if; end $$;
\echo '✓ only creators can invite teammates'
reset role;
