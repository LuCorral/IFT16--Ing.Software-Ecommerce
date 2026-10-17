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
    nombre: "Teclado mecánico compacto",
    precio: 21990,
    stock: 25,
    categoria: "Periféricos",
    descripcion: "Teclado mecánico compacto para escritorios con espacio reducido.",
    image: "/img/TecladoMecanico.jpg",
    rating: 4.6,
    reviews: 138,
  },
  {
    nombre: "Micrófono USB para streaming y videollamadas",
    precio: 49990,
    stock: 20,
    categoria: "Audio",
    descripcion: "Micrófono USB para mejorar la voz en transmisiones y videollamadas.",
    image: "/img/MicrofonoUSB.jpg",
    rating: 4.7,
    reviews: 96,
  },
  {
    nombre: "Cámara de seguridad interior Wi-Fi",
    precio: 39990,
    stock: 24,
    categoria: "Hogar conectado",
    descripcion: "Cámara interior Wi-Fi para supervisar ambientes del hogar desde el celular.",
    image: "/img/CamaraInteriorWifi.jpg",
    rating: 4.5,
    reviews: 112,
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
    nombre: "Enchufe inteligente Wi-Fi",
    precio: 12990,
    stock: 40,
    categoria: "Hogar conectado",
    descripcion: "Enchufe Wi-Fi para controlar dispositivos del hogar desde una aplicación.",
    image: "/img/EnchufeInteligenteWifi.jpg",
    rating: 4.4,
    reviews: 126,
  },
  {
    nombre: "Soporte para celular con carga inalámbrica ajustable",
    precio: 19990,
    stock: 50,
    categoria: "Accesorios",
    descripcion: "Soporte ajustable para celular con carga inalámbrica integrada.",
    image: "/img/SoporteCelularCarga.png",
    rating: 4.3,
    reviews: 134,
  },
  {
    nombre: "Tablet Lenovo Tab M10 Plus 10.6 Fhd",
    precio: 249990,
    stock: 14,
    categoria: "Tecnología",
    descripcion: "Tablet Lenovo Tab M10 Plus con pantalla Full HD de 10,6 pulgadas.",
    image: "/img/TabletLenovoTabM10.png",
    rating: 4.5,
    reviews: 89,
  },
  {
    nombre: "Aspiradora robot Wi-Fi",
    precio: 199990,
    stock: 8,
    categoria: "Hogar conectado",
    descripcion: "Aspiradora robot conectada por Wi-Fi para automatizar la limpieza del hogar.",
    image: "/img/AspiradoraRobot.png",
    rating: 4.6,
    reviews: 245,
  },
  {
    nombre: "Cargador USB-C GaN 65W",
    precio: 34990,
    stock: 50,
    categoria: "Accesorios",
    descripcion: "Cargador compacto USB-C de 65 W con tecnología GaN para dispositivos compatibles.",
    image: "/img/CargadorGaN65W.jpg",
    rating: 4.7,
    reviews: 198,
  },
  {
    nombre: "Repetidor Wi-Fi TP-Link Extensor",
    precio: 22990,
    stock: 55,
    categoria: "Tecnología",
    descripcion: "Extensor de señal Wi-Fi para ampliar la cobertura de la red doméstica.",
    image: "/img/RepetidorTP-Link.png",
    rating: 4.2,
    reviews: 340,
  },
  {
    nombre: "Smart TV 43' Full HD Android",
    precio: 329990,
    stock: 7,
    categoria: "Tecnología",
    descripcion: "Televisor Full HD de 43 pulgadas con sistema Android y conectividad inteligente.",
    image: "/img/SmartTV43.png",
    rating: 4.4,
    reviews: 156,
  },
  {
    nombre: "Cámara de Seguridad Exterior Wi-Fi 1080p",
    precio: 45990,
    stock: 22,
    categoria: "Hogar conectado",
    descripcion: "Cámara Wi-Fi 1080p para monitorear exteriores y recibir alertas de seguridad.",
    image: "/img/CamaraSeguridadExterior.png",
    rating: 4.5,
    reviews: 112,
  },
  {
    nombre: "Mouse Óptico Inalámbrico Logitech M280",
    precio: 18990,
    stock: 80,
    categoria: "Periféricos",
    descripcion: "Mouse óptico inalámbrico Logitech M280 para uso diario.",
    image: "/img/MouseLogitechM280.png",
    rating: 4.8,
    reviews: 520,
  },
  {
    nombre: "Disco Sólido Interno SSD Kingston 480Gb",
    precio: 39990,
    stock: 35,
    categoria: "Almacenamiento",
    descripcion: "Unidad SSD Kingston de 480 GB para mejorar el almacenamiento y la respuesta del equipo.",
    image: "/img/SSDKingston480Gb.png",
    rating: 4.9,
    reviews: 610,
  },
  {
    nombre: "Pendrive Kingston 64GB USB 3.2",
    precio: 9990,
    stock: 75,
    categoria: "Almacenamiento",
    descripcion: "Memoria USB Kingston de 64 GB con interfaz USB 3.2.",
    image: "/img/PendriveKingston64GB.png",
    rating: 4.6,
    reviews: 260,
  },
  {
    nombre: "Disco Externo Portátil 1TB USB 3.0",
    precio: 89990,
    stock: 20,
    categoria: "Almacenamiento",
    descripcion: "Disco externo portátil de 1 TB con conexión USB 3.0.",
    image: "/img/DiscoExterno1TB.png",
    rating: 4.7,
    reviews: 190,
  },
  {
    nombre: "Memoria RAM DDR4 8Gb Fury 3200MHz",
    precio: 28990,
    stock: 42,
    categoria: "Computación",
    descripcion: "Módulo de memoria RAM DDR4 Kingston Fury de 8 GB y 3200 MHz.",
    image: "/img/RAMDDR48GbFury.png",
    rating: 4.8,
    reviews: 289,
  },
  {
    nombre: "Webcam Full HD 1080p con Micrófono",
    precio: 31990,
    stock: 28,
    categoria: "Periféricos",
    descripcion: "Webcam Full HD 1080p con micrófono integrado para reuniones y clases.",
    image: "/img/WebcamFullHD.png",
    rating: 4.1,
    reviews: 73,
  },
  {
    nombre: "Hub USB-C de 4 Puertos de Aluminio",
    precio: 14990,
    stock: 65,
    categoria: "Periféricos",
    descripcion: "Hub USB-C de aluminio para conectar hasta cuatro periféricos compatibles.",
    image: "/img/HubUSB-C4Puertos.png",
    rating: 4.3,
    reviews: 142,
  },
  {
    nombre: "Router Gamer TP-Link Archer AC1200",
    precio: 64990,
    stock: 18,
    categoria: "Computación",
    descripcion: "Router TP-Link Archer AC1200 para conexiones domésticas y gaming.",
    image: "/img/RouterTP-LinkArcher.png",
    rating: 4.6,
    reviews: 97,
  },
  {
    nombre: "Gabinete Kit Mid Tower con Fuente 500W",
    precio: 54990,
    stock: 15,
    categoria: "Computación",
    descripcion: "Gabinete Mid Tower con fuente de alimentación de 500 W.",
    image: "/img/GabineteKitMidTower.png",
    rating: 3.9,
    reviews: 54,
  },
  {
    nombre: "Pad Mouse Gamer Extendido 90x40cm",
    precio: 12500,
    stock: 100,
    categoria: "Periféricos",
    descripcion: "Pad extendido de 90 por 40 cm para teclado y mouse gamer.",
    image: "/img/PadMouseGamer.png",
    rating: 4.7,
    reviews: 315,
  },
  {
    nombre: "Balanza digital de cocina con conectividad",
    precio: 24990,
    stock: 30,
    categoria: "Hogar conectado",
    descripcion: "Balanza digital de cocina con conectividad para registrar mediciones con facilidad.",
    image: "/img/BalanzaCocina.png",
    rating: 4.5,
    reviews: 180,
  },
  {
    nombre: "Barra de sonido Bluetooth 2.1",
    precio: 89990,
    stock: 15,
    categoria: "Audio",
    descripcion: "Barra de sonido Bluetooth 2.1 para mejorar el audio de películas y música.",
    image: "/img/BarraSonido21.jpg",
    rating: 4.6,
    reviews: 210,
  },
  {
    nombre: "Smartwatch Deportivo con Sensor Cardíaco",
    precio: 69990,
    stock: 18,
    categoria: "Electrónica",
    descripcion: "Reloj deportivo inteligente con sensor cardíaco para actividad diaria.",
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
  ["Teclado mecánico compacto", "Mouse inalámbrico compacto"],
  ["Micrófono USB para streaming y videollamadas", "Webcam Full HD para videollamadas"],
  ["Cámara de seguridad interior Wi-Fi", "Cámara WiFi de seguridad para el hogar"],
  ["Enchufe inteligente Wi-Fi", "Soporte plegable para celular y tablet"],
  ["Soporte para celular con carga inalámbrica ajustable", "Soporte Celular para Auto con Carga Inalámbrica"],
  ["Aspiradora robot Wi-Fi", "Aro de Luz LED 26cm con Trípode"],
  ["Cargador USB-C GaN 65W", "Cargador Portátil Powerbank 20000mAh"],
  ["Balanza digital de cocina con conectividad", "Auriculares Bluetooth Inalámbricos"],
  ["Barra de sonido Bluetooth 2.1", "Parlante Bluetooth Portátil"],
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
