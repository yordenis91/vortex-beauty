import React, { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useProducts, useCategories } from '../hooks/useQueries';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ProductCategorySelectProps {
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

const ProductCategorySelect: React.FC<ProductCategorySelectProps> = ({
  value,
  onChange,
  disabled = false,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const loading = productsLoading || categoriesLoading;

  const selectedProduct = products.find((product) => product.id === value);
  const selectedLabel = selectedProduct ? selectedProduct.name : 'Seleccionar producto/servicio...';

  const groupedProducts = useMemo(
    () =>
      categories.map((category) => ({
        category,
        products: products.filter((product) => product.categoryId === category.id),
      })),
    [categories, products]
  );

  const uncategorizedProducts = useMemo(
    () => products.filter((product) => !product.categoryId),
    [products]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-between text-left gap-2',
            loading && 'cursor-wait',
            className
          )}
          disabled={disabled || loading}
        >
          <span className={cn('truncate', !selectedProduct && 'text-muted-foreground')}>
            {loading ? 'Cargando...' : selectedLabel}
          </span>
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[320px] p-0">
        <Command>
          <CommandInput placeholder="Buscar..." />
          <CommandList>
            <CommandEmpty>No se encontraron resultados.</CommandEmpty>

            {groupedProducts.map(({ category, products: categoryProducts }) =>
              categoryProducts.length > 0 ? (
                <CommandGroup key={category.id} heading={category.name}>
                  {categoryProducts.map((product) => (
                    <CommandItem
                      key={product.id}
                      onSelect={() => {
                        onChange(product.id);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4 text-blue-600 transition-opacity',
                          value === product.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {product.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null
            )}

            {uncategorizedProducts.length > 0 && (
              <CommandGroup heading="Otros">
                {uncategorizedProducts.map((product) => (
                  <CommandItem
                    key={product.id}
                    onSelect={() => {
                      onChange(product.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 text-blue-600 transition-opacity',
                        value === product.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {product.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default ProductCategorySelect;
