-- Lets a boarder see how many beds in their own room are occupied, without exposing who.
create function public.room_occupied_count(p_room uuid)
returns integer
language plpgsql stable security definer set search_path = '' as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.rooms where id = p_room;
  if v_org is null or not (private.is_staff(v_org) or private.can_view_room(p_room)) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  return (
    select count(*)::integer
    from public.boarder_assignments a join public.beds b on b.id = a.bed_id
    where b.room_id = p_room and a.move_out_date is null
  );
end
$$;

revoke execute on function public.room_occupied_count(uuid) from public, anon;
grant execute on function public.room_occupied_count(uuid) to authenticated;
