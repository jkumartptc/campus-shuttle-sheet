
REVOKE EXECUTE ON FUNCTION public.bump_bus_pass_download(uuid) FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_bus_pass_qr(uuid) FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_bus_pass_public(text, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_bus_pass_download(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_bus_pass_qr(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_bus_pass_public(text, text) TO anon;
