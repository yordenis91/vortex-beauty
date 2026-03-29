import React, { useMemo } from 'react';
import { Sparkles } from 'lucide-react';

interface GalleryItem {
  id: string;
  title: string;
  image: string;
  category: string;
}

const ClientGallery: React.FC = () => {
  // Mock data de imágenes de manicuras de Unsplash
  const mockGalleryItems: GalleryItem[] = useMemo(() => [
    {
      id: '1',
      title: 'Acrílicas Francesas',
      image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=500&h=500&fit=crop',
      category: 'Acrílicas',
    },
    {
      id: '2',
      title: 'Baby Boomer',
      image: 'https://images.unsplash.com/photo-1632345031435-8917c3a3897d?w=500&h=600&fit=crop',
      category: 'Degradado',
    },
    {
      id: '3',
      title: 'Efecto Cristal',
      image: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=500&h=500&fit=crop',
      category: 'Efecto',
    },
    {
      id: '4',
      title: 'Nude Clásico',
      image: 'https://images.unsplash.com/photo-1657699563004-ab757a748639?w=500&h=600&fit=crop',
      category: 'Clásico',
    },
    {
      id: '5',
      title: 'Neon Vibrante',
      image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=500&h=700&fit=crop',
      category: 'Colorido',
    },
    {
      id: '6',
      title: 'Glitter Gold',
      image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=500&h=500&fit=crop',
      category: 'Brillo',
    },
    {
      id: '7',
      title: 'Ombre Clásico',
      image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=500&h=600&fit=crop',
      category: 'Degradado',
    },
    {
      id: '8',
      title: 'Halloween Art',
      image: 'https://images.unsplash.com/photo-1632345031435-8917c3a3897d?w=500&h=500&fit=crop',
      category: 'Artística',
    },
    {
      id: '9',
      title: 'Minimalista Chic',
      image: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=500&h=700&fit=crop',
      category: 'Minimalista',
    },
    {
      id: '10',
      title: 'Floral Delicado',
      image: 'https://images.unsplash.com/photo-1657699563004-ab757a748639?w=500&h=500&fit=crop',
      category: 'Flores',
    },
    {
      id: '11',
      title: 'Efecto Espejo',
      image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=500&h=600&fit=crop',
      category: 'Efecto',
    },
    {
      id: '12',
      title: 'Degradado Pastel',
      image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=500&h=500&fit=crop',
      category: 'Pastel',
    },
  ], []);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center justify-start gap-3 mb-4">
          <Sparkles className="h-8 w-8 text-purple-600" />
          <h1 className="text-4xl font-bold text-gray-900">Inspiración</h1>
        </div>
        <p className="text-gray-600 text-lg">
          Explora nuestra galería de diseños de manicura y encuentra tu próximo estilo favorito
        </p>
      </div>

      {/* Masonry Grid */}
      <div className="grid gap-6 auto-rows-max grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {mockGalleryItems.map((item, index) => (
          <div
            key={item.id}
            className={`group relative overflow-hidden rounded-xl shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer ${
              // Crear efecto masonry con alturas variadas
              index % 5 === 0 ? 'lg:col-span-1 lg:row-span-2' : ''
            }`}
          >
            {/* Imagen */}
            <div className="relative overflow-hidden bg-gray-200 h-64 sm:h-72">
              <img
                src={item.image}
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              
              {/* Overlay oscuro en hover */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300" />
            </div>

            {/* Content card debajo */}
            <div className="bg-white p-4">
              <h3 className="font-semibold text-gray-900 text-base group-hover:text-purple-600 transition-colors">
                {item.title}
              </h3>
              <p className="text-sm text-gray-600 mt-1">{item.category}</p>
            </div>

            {/* Hover overlay con texto centrado */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-70 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
              <div className="text-center text-white">
                <p className="text-lg font-semibold">{item.title}</p>
                <p className="text-sm mt-2 text-gray-200">{item.category}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer message */}
      <div className="mt-16 text-center py-12 border-t border-gray-200">
        <p className="text-gray-600 text-lg">
          💡 ¿Te gustó alguno de estos diseños? 
          <span className="block mt-2 font-semibold text-purple-600">
            ¡Contacta con nosotras para agendar tu próxima cita!
          </span>
        </p>
      </div>
    </div>
  );
};

export default ClientGallery;
