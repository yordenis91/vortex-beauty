import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { ChevronDown, Plus, Trash2, Check } from 'lucide-react'

const DesignSystem = () => {
  const [selectedAction, setSelectedAction] = useState('Ninguna acción seleccionada')

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-10 flex flex-col gap-4 rounded-3xl border border-border bg-background p-8 shadow-sm shadow-black/5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Centro de diseño UI</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Visualiza los botones, modal y tema global usando los componentes de la librería.
            </p>
          </div>
          <ThemeToggle />
        </div>
      </div>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl border border-border bg-background p-6 shadow-sm shadow-black/5">
          <h2 className="mb-4 text-xl font-semibold text-foreground">Botones</h2>
          <div className="flex flex-wrap gap-3">
            <Button>Primario</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secundario</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Eliminar</Button>
            <Button variant="link">Enlace</Button>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="sm">Pequeño</Button>
            <Button size="lg">Grande</Button>
            <Button variant="outline" size="icon" aria-label="Añadir">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-background p-6 shadow-sm shadow-black/5">
          <h2 className="mb-4 text-xl font-semibold text-foreground">Dropdown</h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="justify-between gap-2">
                Acciones <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent sideOffset={8}>
              <DropdownMenuLabel>Acciones rápidas</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() => setSelectedAction('Vista registrada')}
              >
                <Check className="mr-2 h-4 w-4" /> Ver registro
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setSelectedAction('Elemento creado')}
              >
                <Plus className="mr-2 h-4 w-4" /> Crear elemento
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setSelectedAction('Elemento eliminado')}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <p className="mt-6 rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            {selectedAction}
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-border bg-background p-6 shadow-sm shadow-black/5">
        <h2 className="mb-4 text-xl font-semibold text-foreground">Modal</h2>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">Abrir modal</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modal de ejemplo</DialogTitle>
              <DialogDescription>
                Este modal demuestra la experiencia de usuario para mensajes y formularios.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-2 text-sm">
                <label className="font-medium text-foreground">Nombre</label>
                <input
                  type="text"
                  className="rounded-2xl border border-border bg-input px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Ingresa un nombre"
                />
              </div>
              <div className="grid gap-2 text-sm">
                <label className="font-medium text-foreground">Descripción</label>
                <textarea
                  rows={4}
                  className="resize-none rounded-2xl border border-border bg-input px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Describe la acción"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline">Cancelar</Button>
              <Button>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    </div>
  )
}

export default DesignSystem
