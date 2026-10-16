import React, { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useServices, useCategories } from '../hooks/useQueries';
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

interface ServiceCategorySelectProps {
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

const ServiceCategorySelect: React.FC<ServiceCategorySelectProps> = ({
  value,
  onChange,
  disabled = false,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const { data: services = [], isLoading: servicesLoading } = useServices();
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const loading = servicesLoading || categoriesLoading;

  const selectedService = services.find((service) => service.id === value);
  const selectedLabel = selectedService ? selectedService.name : 'Seleccionar servicio/servicio...';

  const groupedServices = useMemo(
    () =>
      categories.map((category) => ({
        category,
        services: services.filter((service) => service.categoryId === category.id),
      })),
    [categories, services]
  );

  const uncategorizedServices = useMemo(
    () => services.filter((service) => !service.categoryId),
    [services]
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
          <span className={cn('truncate', !selectedService && 'text-muted-foreground')}>
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

            {groupedServices.map(({ category, services: categoryServices }) =>
              categoryServices.length > 0 ? (
                <CommandGroup key={category.id} heading={category.name}>
                  {categoryServices.map((service) => (
                    <CommandItem
                      key={service.id}
                      onSelect={() => {
                        onChange(service.id);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4 text-blue-600 transition-opacity',
                          value === service.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {service.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null
            )}

            {uncategorizedServices.length > 0 && (
              <CommandGroup heading="Otros">
                {uncategorizedServices.map((service) => (
                  <CommandItem
                    key={service.id}
                    onSelect={() => {
                      onChange(service.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 text-blue-600 transition-opacity',
                        value === service.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {service.name}
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

export default ServiceCategorySelect;
