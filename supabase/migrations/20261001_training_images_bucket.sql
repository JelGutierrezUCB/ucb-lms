-- Storage bucket for quiz question images (image-based assessment questions).
-- Same pattern as training-videos: public read, admin-only write.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('training-images', 'training-images', true, 5242880, array['image/png','image/jpeg','image/webp','image/gif']);

create policy training_images_select on storage.objects for select using (bucket_id = 'training-images');
create policy training_images_insert on storage.objects for insert with check (
  bucket_id = 'training-images' and exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin')
);
create policy training_images_delete on storage.objects for delete using (
  bucket_id = 'training-images' and exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin')
);
