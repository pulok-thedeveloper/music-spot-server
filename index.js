const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

require('dotenv').config()

const app = express();

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.tftz42f.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


//Verify JWT TOKEN
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('Unauthorized access');
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    })
}

async function run() {
    try {
        //Collections
        const productCollection = client.db('musicSpot').collection('products');
        const categoryCollection = client.db('musicSpot').collection('categories');
        const userCollection = client.db('musicSpot').collection('users');
        const bookingsCollection = client.db('musicSpot').collection('bookings');

        //Category API
        app.get('/categories', async (req, res) => {
            const query = {};
            const categories = await categoryCollection.find(query).toArray();
            res.send(categories);
        })
        
        //Products API
        //All Products
        //Seller Wise Products
        //Available Category Wise Products
        app.get('/products', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            let query = { email: decodedEmail };
            const user = await userCollection.findOne(query);
            if (!user) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            query = {};
            if (req.query.category) {
                query = {
                    category: req.query.category,
                    status: 'available'
                }
            }
            if (req.query.email) {
                query = {
                    email: req.query.email,
                }
            }
            const products = await productCollection.find(query).toArray();
            res.send(products);
        });

        
        //Advertided Products
        app.get('/advertised', async (req, res) => {
            const query = {
                isAdvertise: true,
                status: 'available'
            };
            const products = await productCollection.find(query).toArray();
            res.send(products);
        })

        //Add Product
        app.post('/products',verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await userCollection.findOne(query);
            if (user?.role !== 'seller') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const product = req.body;
            const result = await productCollection.insertOne(product);
            res.send(result);
        });

        //Advertised Product
        app.put('/products/:id', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await userCollection.findOne(query);
            if (user?.role !== 'seller') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    isAdvertise: true
                }
            }
            const result = await productCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })

        //Delete Products
        app.delete('/products/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id)
            const query = { _id: ObjectId(id) };
            const result = await productCollection.deleteOne(query);
            res.send(result);
        })

        //Bookings or My Orders API
        app.get('/bookings', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { email: email }
            const bookings = await bookingsCollection.find(query).toArray();
            res.send(bookings)
        })

        //Bookings or My Orders API POST
        app.post('/bookings', verifyJWT, async (req, res) => {
            const booking = req.body;
            const decodedEmail = req.decoded.email;
            if (booking.email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            console.log(booking);
            const query = {
                productName: booking.productName,
                email: booking.email
            }

            const alreadyBooked = await bookingsCollection.find(query).toArray();

            if (alreadyBooked.length) {
                const message = 'You already have a booked this product'
                return res.send({ acknowledged: false, message })
            }
            const result = await bookingsCollection.insertOne(booking);
            res.send(result);
        });
    

        //Delete Bookings or My Orders API
        app.delete('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await bookingsCollection.deleteOne(query);
            res.send(result);
        })

        //Jwt API
        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const user = await userCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN)
                return res.send({ accessToken: token });
            }
            console.log(user);
            res.status(403).send({ accessToken: '' })
        })

        //POST Users
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = {
                email: user.email
            }
            const alreadyRegistered = await userCollection.find(query).toArray();

            if (alreadyRegistered.length) {
                const message = 'You have already Registered'
                return res.send({ acknowledged: false, message })
            }

            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        //Get Users
        app.get('/users', async (req, res) => {
            let query = {};
            if (req.query.role) {
                query = { role: req.query.role }
            }
            const users = await userCollection.find(query).toArray();
            res.send(users);
        });

        //Get Admin
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await userCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' });
        })

        //Get Seller
        app.get('/users/seller/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await userCollection.findOne(query);
            res.send(user);
        })

        //Get Buyer
        app.get('/users/buyer/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await userCollection.findOne(query);
            res.send({ isBuyer: user?.role === 'buyer' });
        })

        //MAKE Admin
        app.put('/users/admin/:id', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await userCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })

        //User Verify
        app.put('/users/seller/:id', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await userCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    verifyStatus: 'verified'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })

        //User Delete
        app.delete('/users/:id',verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            let query = { email: decodedEmail };
            const user = await userCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const id = req.params.id;
            console.log(id)
            query = { _id: ObjectId(id) };
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })


    }
    finally {

    }
}

run().catch(console.log)


app.get('/', async (req, res) => {
    res.send('musicspot server is running')
})

app.listen(port, () => console.log(`Music Spot Running on ${port}`))