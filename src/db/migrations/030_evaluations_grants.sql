GRANT ALL ON TABLE evaluations TO authenticated;
GRANT ALL ON TABLE evaluations TO service_role;
NOTIFY pgrst, 'reload schema';
