-- Create a bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product_images', 'product_images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to the product_images bucket
CREATE POLICY "Public read access for product images"
ON storage.objects FOR SELECT
USING ( bucket_id = 'product_images' );

-- Allow authenticated users (admin or collaborator) to upload images
CREATE POLICY "Allow authenticated uploads for product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product_images' AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'collaborator')
);

-- Allow authenticated users (admin or collaborator) to update images
CREATE POLICY "Allow authenticated updates for product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product_images' AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'collaborator')
);

-- Allow authenticated users (admin or collaborator) to delete images
CREATE POLICY "Allow authenticated deletes for product images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product_images' AND
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'collaborator')
);
