const express = require("express");
const mongoose = require("mongoose");
const path = require('path');
const fileUpload = require('express-fileupload');
const { MongoClient, Binary, ObjectId } = require('mongodb');
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const cors = require('cors');
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors({ origin: "http://localhost:5173" }));
app.use(fileUpload({ limits: { fileSize: 50 * 1024 * 1024 }, abortOnLimit: true }));
app.use('/imagenes', express.static(path.join(__dirname, 'imagenes')));


/* const GridFSBucket = require('mongodb').GridFSBucket
const { Readable } = require('stream')

async function getBase64FromGridFS(imageId, db) {
  return new Promise((resolve, reject) => {
    const bucket = new GridFSBucket(db, { bucketName: 'uploads' })
    const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(imageId))

    const chunks = []
    downloadStream.on('data', (chunk) => chunks.push(chunk))
    downloadStream.on('end', () => {
      const buffer = Buffer.concat(chunks)
      const base64 = buffer.toString('base64')
      resolve(base64)
    })
    downloadStream.on('error', reject)
  })
}
 */

const mongoURI = process.env.MONGO_URI;

mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000 // Espera 5 segundos para conectar
}).then(() => {
    console.log("📌 Conectado a MongoDB");
}).catch(err => {
    console.error("❌ Error al conectar a MongoDB:", err);
});

// 🔹 Usa la conexión de mongoose en lugar de MongoClient
const db = mongoose.connection;

// Si hay un error de conexión
db.on("error", console.error.bind(console, "❌ Error de conexión a MongoDB:"));

// 🔹 Verifica si la conexión está lista antes de usar `db.collection()`
db.once("open", () => {
    console.log("📂 Conexión a la base de datos establecida correctamente");
});

const InmuebleSchema = new mongoose.Schema({
    propietario_id: mongoose.Schema.Types.ObjectId,
    ubicacion: String,
    precio: Number,
    caracteristicas: [String],
    imagenes: [ObjectId],
    disponible: Boolean,
    contratos: [{
        inquilino_id: mongoose.Schema.Types.ObjectId,
        fecha_inicio: Date,
        fecha_fin: Date,
        monto_renta: Number,
        estado: String,
        pagos_renta: [{
            monto: Number,
            fecha: Date,
            estado: String
        }]
    }],
    solicitudes_renta: [{
        inquilino_id: mongoose.Schema.Types.ObjectId,
        fecha_solicitud: Date,
        estado: String
    }],
    reseñas: [{
        inquilino_id: mongoose.Schema.Types.ObjectId,
        calificacion: Number,
        comentario: String,
        fecha: Date
    }]
});

const Inmueble = mongoose.model("Inmueble", InmuebleSchema);

// Middleware para manejar imágenes
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Crear inmueble
/**
 * 📌 CORRECCIÓN: Verificar que `db` está definido antes de acceder a `collection()`
 */
/*app.post("/inmuebles/:id/imagenes", upload.array("imagenes"), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).send("No se enviaron archivos");
    }

    try {
        if (!db) {
            return res.status(500).json({ message: "❌ La conexión a la base de datos no está disponible" });
        }

        const collection = db.collection("archivos");
        const inmuebles = db.collection("inmuebles");

        const imagenesInsertadas = await Promise.all(req.files.map(async (file) => {
            const fileData = {
                content: new Binary(file.buffer),
                name: file.originalname,
                contentType: file.mimetype,
                uploadDate: new Date(),
            };
            const result = await collection.insertOne(fileData);
            return result.insertedId;
        }));

        await inmuebles.updateOne(
            { _id: new ObjectId(req.params.id) },
            { $push: { imagenes: { $each: imagenesInsertadas } } }
        );

        res.json({ imagenes: imagenesInsertadas, message: "Imágenes subidas correctamente" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});*/





app.post("/inmuebles/:id/imagenes", async (req, res) => {
    if (!req.files || !req.files.imagenes) {
        return res.status(400).json({ message: "No se enviaron imágenes" });
    }

    try {
        const collection = db.collection("archivos");
        const inmuebles = db.collection("inmuebles");

        // Asegura que req.files.imagenes siempre sea un array
        const archivos = Array.isArray(req.files.imagenes) ? req.files.imagenes : [req.files.imagenes];

        const imagenesInsertadas = await Promise.all(archivos.map(async (file) => {
            const fileData = {
                content: new Binary(file.data),
                name: file.name,
                contentType: file.mimetype,
                uploadDate: new Date(),
            };
            const result = await collection.insertOne(fileData);
            return result.insertedId;
        }));

        await inmuebles.updateOne(
            { _id: new ObjectId(req.params.id) },
            { $push: { imagenes: { $each: imagenesInsertadas } } }
        );

        res.status(201).json({ imagenes: imagenesInsertadas, message: "Imágenes subidas correctamente" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// 📌 CREACIÓN DE INMUEBLE
app.post("/inmuebles", async (req, res) => {
    try {
        const nuevoInmueble = new Inmueble(req.body);
        const inmuebleGuardado = await nuevoInmueble.save();
        res.status(201).json(inmuebleGuardado);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

/* app.get("/imagenes/:id", async (req, res) => {
  try {
    const collection = db.collection("archivos");
    const result = await collection.findOne({ _id: new ObjectId(req.params.id) });
    if (!result) {
      return res.status(404).json({ message: "Imagen no encontrada" });
    }
    res.setHeader("Content-Disposition", `inline; filename=\"${result.name}\"`);
    res.setHeader("Content-Type", result.contentType);
    res.send(result.content.buffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}); */

app.get("/imagenes/:id", async (req, res) => {
    try {
        // Buscar la imagen en la colección de archivos
        const collection = db.collection("archivos");
        const result = await collection.findOne({ _id: new ObjectId(req.params.id) });

        // Si no se encuentra la imagen, retornar error 404
        if (!result) {
            return res.status(404).json({ message: "Imagen no encontrada" });
        }

        // Convertir la imagen binaria a base64
        const base64Image = result.content.buffer.toString('base64');
        const imageUrl = `data:${result.contentType};base64,${base64Image}`;

        // Enviar la URL base64 como respuesta
        res.json({ imageUrl });
    } catch (error) {
        // Manejo de errores
        res.status(500).json({ message: error.message });
    }
});




// Leer todos los inmuebles
app.get("/inmuebles", async (req, res) => {
    try {
        const inmuebles = await Inmueble.find();
        res.json(inmuebles);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Obtener inmueble por ID
app.get("/inmuebles/:id", async (req, res) => {
    try {
        const inmueble = await Inmueble.findById(req.params.id);
        if (!inmueble) return res.status(404).json({ message: "Inmueble no encontrado" });
        res.json(inmueble);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Actualizar inmueble
app.put("/inmuebles/:id", async (req, res) => {
    try {
        const inmuebleActualizado = await Inmueble.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!inmuebleActualizado) return res.status(404).json({ message: "Inmueble no encontrado" });
        res.json(inmuebleActualizado);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Eliminar inmueble
app.delete("/inmuebles/:id", async (req, res) => {
    try {
        await Inmueble.findByIdAndDelete(req.params.id);
        res.json({ message: "Inmueble eliminado" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Subir imágenes
// app.post("/inmuebles/:id/imagenes", upload.array("imagenes"), async (req, res) => {
//     try {
//         const urls = req.files.map(file => `${process.env.UPLOADS_URL}/${file.filename}`);
//         const inmueble = await Inmueble.findByIdAndUpdate(req.params.id, { $push: { imagenes: { $each: urls } } }, { new: true });
//         res.json(inmueble);
//     } catch (error) {
//         res.status(500).json({ message: error.message });
//     }
// });

// Crear solicitud de renta para un inmueble
app.post("/inmuebles/:id/solicitudes_renta", async (req, res) => {
    try {
        const { inquilino_id, estado } = req.body;
        const inmueble = await Inmueble.findById(req.params.id);

        if (!inmueble) {
            return res.status(404).json({ message: "Inmueble no encontrado" });
        }

        const nuevaSolicitud = {
            inquilino_id,
            fecha_solicitud: new Date(),
            estado // Puede ser 'pendiente', 'aprobado', 'rechazado'
        };

        // Añadir la solicitud al inmueble
        inmueble.solicitudes_renta.push(nuevaSolicitud);
        await inmueble.save();

        res.status(201).json(inmueble);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Obtener todas las solicitudes de renta de un inmueble
app.get("/inmuebles/:id/solicitudes_renta", async (req, res) => {
    try {
        const inmueble = await Inmueble.findById(req.params.id);

        if (!inmueble) {
            return res.status(404).json({ message: "Inmueble no encontrado" });
        }

        res.json(inmueble.solicitudes_renta);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Crear una reseña para un inmueble
app.post("/inmuebles/:id/resenas", async (req, res) => {
    try {
        const { inquilino_id, calificacion, comentario } = req.body;
        const inmueble = await Inmueble.findById(req.params.id);

        if (!inmueble) {
            return res.status(404).json({ message: "Inmueble no encontrado" });
        }

        const nuevaReseña = {
            inquilino_id,
            calificacion,
            comentario,
            fecha: new Date()
        };

        // Añadir la reseña al inmueble
        inmueble.reseñas.push(nuevaReseña);
        await inmueble.save();

        res.status(201).json(inmueble);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Obtener todas las reseñas de un inmueble
app.get("/inmuebles/:id/resenas", async (req, res) => {
    try {
        const inmueble = await Inmueble.findById(req.params.id);

        if (!inmueble) {
            return res.status(404).json({ message: "Inmueble no encontrado" });
        }

        res.json(inmueble.reseñas);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
