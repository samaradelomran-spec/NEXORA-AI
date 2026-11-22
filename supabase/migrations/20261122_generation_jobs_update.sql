-- Allow each authenticated user to update their own generation job status/result.
-- Required for async media jobs to move from queued/processing to completed/failed.

create policy "Users can update their own generation jobs"
on public.generation_jobs
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());
