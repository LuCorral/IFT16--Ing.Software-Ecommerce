require("dotenv").config();

const sequelize = require("./src/config/database");
const Producto = require("./src/models/Producto");

const productosIniciales = [
  {
    nombre: "Aro de luz LED de escritorio con trípode",
    precio: 27990,
    stock: 36,
    categoria: "Accesorios",
    descripcion: "Iluminación regulable para videollamadas, lectura y trabajo en escritorio.",
    image: "/img/ArodeLuzLED.png",
    rating: 4.5,
    reviews: 310,
  },
  {
    nombre: "Parlante Bluetooth compacto",
    precio: 42990,
    stock: 28,
    categoria: "Audio",
    descripcion: "Parlante portátil con conexión inalámbrica y batería recargable.",
    image: "/img/ParlanteBluetooth.png",
    rating: 4.8,
    reviews: 95,
  },
  {
    nombre: "Auriculares deportivos inalámbricos",
    precio: 38990,
    stock: 32,
    categoria: "Audio",
    descripcion: "Auriculares Bluetooth livianos para escuchar música durante el día.",
    image: "/img/AuricularesBluetooth.png",
    rating: 4.2,
    reviews: 115,
  },
  {
    nombre: "Mouse inalámbrico compacto",
    precio: 21990,
    stock: 48,
    categoria: "Periféricos",
    descripcion: "Mouse óptico inalámbrico de tamaño compacto para uso diario.",
    image: "/img/MouseLogitechM280.png",
    rating: 4.0,
    reviews: 78,
  },
  {
    nombre: "Webcam Full HD para videollamadas",
    precio: 35990,
    stock: 24,
    categoria: "Periféricos",
    descripcion: "Cámara web Full HD con micrófono integrado para reuniones y clases.",
    image: "/img/WebcamFullHD.png",
    rating: 4.6,
    reviews: 204,
  },
  {
    nombre: "Cámara WiFi de seguridad para el hogar",
    precio: 48990,
    stock: 18,
    categoria: "Hogar conectado",
    descripcion: "Cámara de seguridad conectada por WiFi para monitorear espacios del hogar.",
    image: "/img/CamaraSeguridadExterior.png",
    rating: 4.4,
    reviews: 62,
  },
  {
    nombre: "Batería portátil Powerbank 20000 mAh",
    precio: 42990,
    stock: 34,
    categoria: "Accesorios",
    descripcion: "Batería portátil de alta capacidad para cargar dispositivos durante el día.",
    image: "/img/Powerbank20000mAh.png",
    rating: 4.7,
    reviews: 412,
  },
  {
    nombre: "Soporte plegable para celular y tablet",
    precio: 16990,
    stock: 42,
    categoria: "Accesorios",
    descripcion: "Soporte ajustable para mantener el celular o la tablet a la vista.",
    image: "/img/SoporteCelularCarga.png",
    rating: 4.1,
    reviews: 88,
  },
  {
    nombre: "Soporte Celular para Auto con Carga Inalámbrica",
    precio: 19990,
    stock: 50,
    categoria: "Tecnología",
    image: "/img/SoporteCelularCarga.png",
    rating: 4.3,
    reviews: 134,
  },
  {
    nombre: "Tablet Lenovo Tab M10 Plus 10.6 Fhd",
    precio: 249990,
    stock: 14,
    categoria: "Tecnología",
    image: "/img/TabletLenovoTabM10.png",
    rating: 4.5,
    reviews: 89,
  },
  {
    nombre: "Aro de Luz LED 26cm con Trípode",
    precio: 15990,
    stock: 70,
    categoria: "Tecnología",
    image: "/img/ArodeLuzLED.png",
    rating: 4.0,
    reviews: 245,
  },
  {
    nombre: "Cargador Portátil Powerbank 20000mAh",
    precio: 38990,
    stock: 40,
    categoria: "Tecnología",
    image: "/img/Powerbank20000mAh.png",
    rating: 4.7,
    reviews: 198,
  },
  {
    nombre: "Repetidor Wi-Fi TP-Link Extensor",
    precio: 22990,
    stock: 55,
    categoria: "Tecnología",
    image: "/img/RepetidorTP-Link.png",
    rating: 4.2,
    reviews: 340,
  },
  {
    nombre: "Smart TV 43' Full HD Android",
    precio: 329990,
    stock: 7,
    categoria: "Tecnología",
    image: "/img/SmartTV43.png",
    rating: 4.4,
    reviews: 156,
  },
  {
    nombre: "Cámara de Seguridad Exterior Wi-Fi 1080p",
    precio: 45990,
    stock: 22,
    categoria: "Tecnología",
    image: "/img/CamaraSeguridadExterior.png",
    rating: 4.5,
    reviews: 112,
  },
  {
    nombre: "Mouse Óptico Inalámbrico Logitech M280",
    precio: 18990,
    stock: 80,
    categoria: "Periféricos",
    image: "/img/MouseLogitechM280.png",
    rating: 4.8,
    reviews: 520,
  },
  {
    nombre: "Disco Sólido Interno SSD Kingston 480Gb",
    precio: 39990,
    stock: 35,
    categoria: "Almacenamiento",
    image: "/img/SSDKingston480Gb.png",
    rating: 4.9,
    reviews: 610,
  },
  {
    nombre: "Pendrive Kingston 64GB USB 3.2",
    precio: 9990,
    stock: 75,
    categoria: "Almacenamiento",
    image: "/img/PendriveKingston64GB.png",
    rating: 4.6,
    reviews: 260,
  },
  {
    nombre: "Disco Externo Portátil 1TB USB 3.0",
    precio: 89990,
    stock: 20,
    categoria: "Almacenamiento",
    image: "/img/DiscoExterno1TB.png",
    rating: 4.7,
    reviews: 190,
  },
  {
    nombre: "Memoria RAM DDR4 8Gb Fury 3200MHz",
    precio: 28990,
    stock: 42,
    categoria: "Computación",
    image: "/img/RAMDDR48GbFury.png",
    rating: 4.8,
    reviews: 289,
  },
  {
    nombre: "Webcam Full HD 1080p con Micrófono",
    precio: 31990,
    stock: 28,
    categoria: "Periféricos",
    image: "/img/WebcamFullHD.png",
    rating: 4.1,
    reviews: 73,
  },
  {
    nombre: "Hub USB-C de 4 Puertos de Aluminio",
    precio: 14990,
    stock: 65,
    categoria: "Periféricos",
    image: "/img/HubUSB-C4Puertos.png",
    rating: 4.3,
    reviews: 142,
  },
  {
    nombre: "Router Gamer TP-Link Archer AC1200",
    precio: 64990,
    stock: 18,
    categoria: "Computación",
    image: "/img/RouterTP-LinkArcher.png",
    rating: 4.6,
    reviews: 97,
  },
  {
    nombre: "Gabinete Kit Mid Tower con Fuente 500W",
    precio: 54990,
    stock: 15,
    categoria: "Computación",
    image: "/img/GabineteKitMidTower.png",
    rating: 3.9,
    reviews: 54,
  },
  {
    nombre: "Pad Mouse Gamer Extendido 90x40cm",
    precio: 12500,
    stock: 100,
    categoria: "Periféricos",
    image: "/img/PadMouseGamer.png",
    rating: 4.7,
    reviews: 315,
  },
  {
    nombre: "Auriculares Bluetooth Inalámbricos",
    precio: 34990,
    stock: 30,
    categoria: "Electrónica",
    image: "/img/AuricularesBluetooth.png",
    rating: 4.5,
    reviews: 180,
  },
  {
    nombre: "Parlante Bluetooth Portátil",
    precio: 52990,
    stock: 24,
    categoria: "Electrónica",
    image: "/img/ParlanteBluetooth.png",
    rating: 4.6,
    reviews: 210,
  },
  {
    nombre: "Smartwatch Deportivo con Sensor Cardíaco",
    precio: 69990,
    stock: 18,
    categoria: "Electrónica",
    image: "/img/SmartwatchDeportivo.png",
    rating: 4.4,
    reviews: 165,
  },
];

const nombresAnteriores = new Map([
  ["Aro de luz LED de escritorio con trípode", "Pava Eléctrica Corte Mate 1.7L"],
  ["Parlante Bluetooth compacto", "Cafetera Express 15 Bares"],
  ["Auriculares deportivos inalámbricos", "Licuadora de Mano 800W"],
  ["Mouse inalámbrico compacto", "Tostadora Eléctrica Oster"],
  ["Webcam Full HD para videollamadas", "Microondas Digital 20L BGH"],
  ["Cámara WiFi de seguridad para el hogar", "Aspiradora Robot Inteligente Wi-Fi"],
  ["Batería portátil Powerbank 20000 mAh", "Balanza de Cocina Digital 5kg"],
  ["Soporte plegable para celular y tablet", "Exprimidor de Cítricos Eléctrico 1L"],
]);

async function seedDatabase() {
  try {
    console.log("📂 Conectando a la base de datos...");

    await sequelize.authenticate();
    console.log("✅ Conexión exitosa");

    console.log("🔄 Sincronizando tabla de productos...");
    await Producto.sync({ alter: true });
    console.log("✅ Tabla de productos creada/actualizada sin borrar datos existentes");

    console.log("📝 Insertando productos...");
    let insertados = 0;

    for (let i = 0; i < productosIniciales.length; i++) {
      const producto = productosIniciales[i];
      try {
        const nombreAnterior = nombresAnteriores.get(producto.nombre);
        const productoExistente = nombreAnterior
          ? await Producto.findOne({ where: { nombre: nombreAnterior } })
          : null;

        if (productoExistente) {
          await productoExistente.update(producto);
          console.log(`   ↻ ${i + 1}. Actualizado: ${producto.nombre}`);
          continue;
        }

        const [, created] = await Producto.findOrCreate({
          where: { nombre: producto.nombre },
          defaults: producto,
        });

        if (created) {
          insertados++;
          console.log(`   ✓ ${i + 1}. ${producto.nombre}`);
        } else {
          console.log(`   - ${i + 1}. Ya existía: ${producto.nombre}`);
        }
      } catch (err) {
        console.error(
          `   ✗ ${i + 1}. Error con ${producto.nombre}:`,
          err.message,
        );
      }
    }

    console.log(
      `✅ ${insertados} de ${productosIniciales.length} productos insertados`,
    );

    const count = await Producto.count();
    console.log(`📊 Total de productos en BD: ${count}`);

    const productos = await Producto.findAll({ limit: 3 });
    console.log("📋 Primeros productos:");
    productos.forEach((p) => {
      console.log(`   - ${p.nombre}: $${p.precio}`);
    });

    console.log("🎉 Seed completado exitosamente!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error general:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

seedDatabase();
