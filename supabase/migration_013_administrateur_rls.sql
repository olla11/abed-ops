-- Migration 013 : étendre les RLS pour inclure le rôle 'administrateur'

-- SELECT missions
DROP POLICY IF EXISTS "missionnaire voit ses missions" ON public.missions;
CREATE POLICY "missionnaire voit ses missions" ON public.missions FOR SELECT USING (
  missionnaire_id = auth.uid()
  OR public.current_role() IN ('caf','de','admin','administrateur')
);

-- UPDATE missions
DROP POLICY IF EXISTS "missionnaire modifie ses missions non clôturées" ON public.missions;
CREATE POLICY "missionnaire modifie ses missions non cloturees" ON public.missions FOR UPDATE USING (
  (missionnaire_id = auth.uid() AND status NOT IN ('cloture'))
  OR public.current_role() IN ('caf','de','admin','administrateur')
);

-- SELECT payments
DROP POLICY IF EXISTS "voir paiements de ses missions ou caf/de" ON public.payments;
CREATE POLICY "voir paiements de ses missions ou caf/de" ON public.payments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.missions m
    WHERE m.id = payments.mission_id
      AND (m.missionnaire_id = auth.uid()
           OR public.current_role() IN ('caf','de','admin','administrateur'))
  )
);
