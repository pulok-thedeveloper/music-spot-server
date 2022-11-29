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

function verifyJWT(req, res, next){
    const authHeader = req.headers.authorization;
    if(!authHeader){
        return res.status(401).send('Unauthorized access');
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function(err, decoded){
        if(err){
            res.status(403).send({message: 'forbidden access'})
        }
        req.decoded = decoded;
        next();
    })
}

async function run(){
    try{
        const productCollection = client.db('musicSpot').collection('products');
        const categoryCollection = client.db('musicSpot').collection('categories');
        const userCollection = client.db('musicSpot').collection('users');
        const bookingsCollection = client.db('musicSpot').collection('bookings');

        app.get('/categories', async(req,res)=>{
            const query ={};
            const categories = await categoryCollection.find(query).toArray();
            res.send(categories);
        })

        app.get('/products', async(req,res)=>{
            let query ={};
            if(req.query.category){
                query = {category: req.query.category}
            }
            if(req.query.email){
                query = {email: req.query.email}
            }
            const products = await productCollection.find(query).toArray();
            res.send(products);
        });

        app.post('/products',async (req, res) => {
            const product = req.body;
            const result = await productCollection.insertOne(product);
            res.send(result);
        });

        app.get('/bookings',verifyJWT, async (req,res)=>{
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if(email !== decodedEmail){
                return res.status(403).send({message: 'forbidden access'})
            }
            const query = {email: email}
            const bookings = await bookingsCollection.find(query).toArray();
            res.send(bookings)
        })


        app.post('/bookings', async (req, res) => {
            const booking = req.body;
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

        app.get('/jwt', async(req,res)=>{
            const email = req.query.email;
            const query = {email: email}
            const user = await userCollection.findOne(query);
            if(user){
                const token = jwt.sign({email}, process.env.ACCESS_TOKEN)
                return res.send({accessToken: token});
            }
            console.log(user);
            res.status(403).send({accessToken: ''})
        })


        app.post('/users', async (req, res) => {
            const user = req.body;
            const query ={
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

          app.get('/users', async(req,res)=>{
            let query ={};
            if(req.query.role){
                query = {role: req.query.role}
            }
            const users = await userCollection.find(query).toArray();
            res.send(users);
          });

          app.get('/users/admin/:email', async(req,res)=>{
            const email = req.params.email;
            const query = {email}
            const user = await userCollection.findOne(query);
            res.send({isAdmin: user?.role === 'admin'});
          })

          app.get('/users/seller/:email', async(req,res)=>{
            const email = req.params.email;
            const query = {email}
            const user = await userCollection.findOne(query);
            res.send({isSeller: user?.role === 'seller'});
          })

          app.get('/users/buyer/:email', async(req,res)=>{
            const email = req.params.email;
            const query = {email}
            const user = await userCollection.findOne(query);
            res.send({isBuyer: user?.role === 'buyer'});
          })
          
          app.put('/users/admin/:id', verifyJWT, async(req, res) =>{
            const decodedEmail = req.decoded.email;
            const query = {email: decodedEmail};
            const user = await userCollection.findOne(query);
            if(user?.role !== 'admin'){
                return res.status(403).send({message: 'forbidden access'})
            }
            const id = req.params.id;
            const filter = {_id: ObjectId(id)}
            const options = {upsert: true};
            const updatedDoc = {
                $set:{
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
          })

          app.put('/users/seller/:id', verifyJWT, async(req, res) =>{
            const decodedEmail = req.decoded.email;
            const query = {email: decodedEmail};
            const user = await userCollection.findOne(query);
            if(user?.role !== 'admin'){
                return res.status(403).send({message: 'forbidden access'})
            }
            const id = req.params.id;
            const filter = {_id: ObjectId(id)}
            const options = {upsert: true};
            const updatedDoc = {
                $set:{
                    verifyStatus: 'verified'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
          })

        
    }
    finally{

    }
}

run().catch(console.log)


app.get('/', async(req,res)=>{
    res.send('musicspot server is running')
})

app.listen(port, ()=> console.log(`Music Spot Running on ${port}`))