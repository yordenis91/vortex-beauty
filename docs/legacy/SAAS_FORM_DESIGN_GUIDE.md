# Guía de Diseño: Formulario SaaS Premium

## Descripción General
Esta guía documenta el estilo premium SaaS aplicado al formulario de facturas, basado en el diseño del formulario de clientes. Proporciona una experiencia visual moderna, limpia y profesional que se alinea con estándares SaaS actuales.

## 🎨 Estilo del Modal
- **Contenedor**: `bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden max-h-[90vh] overflow-y-auto`
- **Posicionamiento**: `fixed inset-0 bg-black/50 transition-opacity flex items-center justify-center z-50 p-4`
- **Header Sticky**: `sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 flex items-center justify-between`
- **Título del Header**: `text-2xl font-bold text-white`
- **Botón de Cierre**: Icono SVG con `text-blue-100 hover:text-white transition`

## 📋 Estructura del Formulario
- **Contenedor del Form**: `p-8 space-y-8`
- **Secciones**: Sin tarjetas grises, solo títulos con borde inferior
- **Títulos de Sección**: `text-sm font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-200`

## 🔧 Estilo de Inputs y Controles
### Inputs de Texto, Email, Date, Select
```css
w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition
```

### Textarea
```css
w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition
```

### Labels
```css
block text-sm font-medium text-gray-700 mb-2
```

### Campos Requeridos
- Agregar `<span className="text-red-500">*</span>` al lado del label

### Placeholders
- Descriptivos y útiles para mejorar UX

## 🎯 Botonera Final (Actions)
- **Contenedor**: `flex justify-end gap-3 pt-6 border-t border-gray-200`

### Botón Cancelar/Secundario
```css
px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition font-medium
```

### Botón Guardar/Primario
```css
px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2
```

## ✨ Detalles Premium Adicionales
- **Transiciones**: `transition` en elementos interactivos
- **Sombras**: `shadow-2xl` para profundidad visual
- **Bordes**: `rounded-2xl` para modernidad
- **Espaciado**: `gap-3`, `space-y-8` para armonía visual
- **Estados**: Hover, focus, disabled apropiados

## 📐 Grid y Layout
- **Contenedor de Campos**: `grid grid-cols-1 md:grid-cols-2 gap-6`
- **Campos Largos**: Ocupan `md:col-span-2` (ej: textarea de notas)
- **Formularios Anidados**: `grid-cols-1 md:grid-cols-12` con spans apropiados

## 🎨 Paleta de Colores
- **Primario**: Azul (`blue-600`, `blue-700`)
- **Texto**: `text-gray-900`, `text-gray-700`, `text-gray-500`
- **Fondos**: `bg-white`, `bg-gray-50`, `bg-gray-100`
- **Bordes**: `border-gray-300`, `border-gray-200`
- **Estados**: `hover:bg-gray-200`, `focus:ring-blue-500`

## 🔧 Instrucciones de Implementación
1. Reemplazar el modal existente con la estructura centrada
2. Aplicar header con gradiente azul
3. Actualizar títulos de sección con borde inferior
4. Estandarizar todos los inputs con las clases especificadas
5. Implementar botonera con estilos definidos
6. Agregar placeholders descriptivos
7. Verificar responsive design con `md:` breakpoints

## 📝 Notas Importantes
- Mantener consistencia con otros formularios de la plataforma
- Usar iconos Lucide-React para elementos interactivos
- Implementar validación visual con estados de error apropiados
- Asegurar accesibilidad con labels correctos y navegación por teclado