-- Create a bucket for product images
insert into storage.buckets (id, name, public)
values ('product_images', 'product_images', true)
on conflict (id) do nothing;

-- Set up security rules for the product_images bucket
drop policy if exists "Allow public read access" on storage.objects;
create policy "Allow public read access"
on storage.objects for select
using ( bucket_id = 'product_images' );

drop policy if exists "Allow authenticated uploads" on storage.objects;
create policy "Allow authenticated uploads"
on storage.objects for insert
with check ( bucket_id = 'product_images' and auth.role() = 'authenticated' and (select role from public.profiles where id = auth.uid()) in ('admin', 'collaborator') );

drop policy if exists "Allow authenticated updates" on storage.objects;
create policy "Allow authenticated updates"
on storage.objects for update
using ( bucket_id = 'product_images' and auth.role() = 'authenticated' and (select role from public.profiles where id = auth.uid()) in ('admin', 'collaborator') );

drop policy if exists "Allow authenticated deletes" on storage.objects;
create policy "Allow authenticated deletes"
on storage.objects for delete
using ( bucket_id = 'product_images' and auth.role() = 'authenticated' and (select role from public.profiles where id = auth.uid()) in ('admin', 'collaborator') );
