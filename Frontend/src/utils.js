export const getImageForProduct = (product) => {
  // Prefer actual image_url from the catalog data
  if (product.image_url && product.image_url.startsWith('http')) return product.image_url;
  if (product.img_url && product.img_url.startsWith('http')) return product.img_url;

  // Fallback to a random stock photo
  const idStr = String(product.product_id).replace(/\D/g, '');
  const seed = (parseInt(idStr || '1') % 10000) + 1;
  return `https://picsum.photos/seed/${seed}/400/400`;
};
