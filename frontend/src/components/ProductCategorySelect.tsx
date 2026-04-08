import React from 'react';
import { useProducts, useCategories } from '../hooks/useQueries';

interface ProductCategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

const ProductCategorySelect: React.FC<ProductCategorySelectProps> = ({
  value,
  onChange,
  className = '',
  disabled = false,
}) => {
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const loading = productsLoading || categoriesLoading;

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(event.target.value);
  };

  const baseClasses =
    'w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition';

  const groupedProducts = categories.map((category) => ({
    category,
    products: products.filter((product) => product.categoryId === category.id),
  }));

  const uncategorizedProducts = products.filter((product) => !product.categoryId);

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={disabled || loading}
      className={`${baseClasses} ${className}`.trim()}
    >
      <option value="">Selecciona una opción...</option>
      {loading ? (
        <option value="">Cargando catálogo...</option>
      ) : (
        <>
          {groupedProducts.map(({ category, products: categoryProducts }) =>
            categoryProducts.length > 0 ? (
              <optgroup key={category.id} label={category.name}>
                {categoryProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} - {product.price} {product.currency}
                  </option>
                ))}
              </optgroup>
            ) : null
          )}
          {uncategorizedProducts.length > 0 && (
            <optgroup label="Otros / Sin Categoría">
              {uncategorizedProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} - {product.price} {product.currency}
                </option>
              ))}
            </optgroup>
          )}
        </>
      )}
    </select>
  );
};

export default ProductCategorySelect;
