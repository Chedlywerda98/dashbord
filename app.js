const express			= require('express');
const session			= require('express-session');
const hbs				= require('express-handlebars');
const mongoose			= require('mongoose');
const passport			= require('passport');
const localStrategy		= require('passport-local').Strategy;
const bcrypt			= require('bcrypt');
const app				= express();
const router            = express.Router();





mongoose.connect("mongodb+srv://chedlywerda:oIDqDC7FfNABYLlV@cluster0.fjsrksp.mongodb.net/ChatBot", {
	useNewUrlParser: true,
	useUnifiedTopology: true
}).catch((error) => {
	console.log("Error connecting to MongoDB Atlas: " + error);
});

const db = mongoose.connection;

db.once("open", () => {
	console.log("Connected to MongoDB database 'test'");
});

db.on("error", (error) => {
	console.log("MongoDB connection error: " + error);
});


const users = mongoose.model('Users', {
	username: {
		type: String,
		required: true
	},
	password: {
		type: String,
		required: true
	}
});

const conversationSchema = new mongoose.Schema({
  user_input: [{ type: String, required: true }],
  bot_response: { type: String, required: true }
}, { collection: 'Convs' });

const Conversation = mongoose.model('Conversation', conversationSchema);


const QRSchema = new mongoose.Schema({
	intents: [{
	  tag: { type: String, required: true },
	  patterns: { type: [String], required: true },
	  responses: { type: [String], required: true }
	}]
}, { collection: 'QR' });
  
const question = mongoose.model('question', QRSchema);
  

 


// Middleware
app.engine('hbs', hbs({ extname: '.hbs', 
		runtimeOptions: {
			allowProtoPropertiesByDefault: true,
		}
	}));
app.set('view engine', 'hbs');
app.use(express.static(__dirname + '/public'));
app.use(session({
	secret: "verygoodsecret",
	resave: false,
	saveUninitialized: true
}));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Passport.js
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function (users, done) {
	done(null, users.id);
});

passport.deserializeUser(function (id, done) {
	users.findById(id)
		.then(function (users) {
			done(null, users);
		})
		.catch(function (err) {
			done(err);
		});
});
passport.use(new localStrategy(async function (username, password, done) {
	try {
		const user = await users.findOne({ username: username });

		if (!user) {
			return done(null, false, { message: 'Incorrect username or password.' });
		}

		const passwordMatch = await bcrypt.compare(password, user.password);

		if (!passwordMatch) {
			return done(null, false, { message: 'Incorrect username or password.' });
		}

		return done(null, user);
	} catch (err) {
		return done(err);
	}
}));

function isLoggedIn(req, res, next) {
	if (req.isAuthenticated()) return next();
	res.redirect('/login');
}

function isLoggedOut(req, res, next) {
	if (!req.isAuthenticated()) return next();
	res.redirect('/');
}


// ROUTES
app.get('/', isLoggedIn, (req, res) => {
	res.render("index", { title: "Home" });
  });


app.get('/conversations', isLoggedIn, function(req, res) {
	Conversation.find().then(function(conversations) {
	  res.render('conversations',{ title: "Conversation" ,conversations: conversations });
	}).catch(function(error) {
	  console.log(error);
	  res.status(500).send('Internal Server Error');
	});
});

app.get('/popup', isLoggedIn, (req, res) => {
	res.render("popup", { title: "popup" });
  });


app.get('/questions', isLoggedIn, function(req, res) {
	question.find({}).then(function(questions) {
	  res.render('questions', { title: "Q/R", questions: questions });
	}).catch(function(error) {
	  console.log(error);
	  res.status(500).send('Internal Server Error');
	});
  });
  
  app.get('/tags/:id', isLoggedIn, function(req, res) {
	const intentId = req.params.id;
  
	question.findById(intentId)
	  .then(intent => {
		res.render('tags', { title: "Tags", patterns: intent.intents[0].patterns, responses: intent.intents[0].responses });
	  })
	  .catch(error => {
		console.error('Error occurred:', error);
		res.sendStatus(500);
	  });
  });
  
  
  

app.get('/login', isLoggedOut, (req, res) => {
	const response = {
		title: "Login",
		error: req.query.error
	}

	res.render('login', response);
});

app.post('/login', passport.authenticate('local', {
	successRedirect: '/',
	failureRedirect: '/login?error=true'
}));

app.get('/logout', function(req, res){
	req.logout(function(err) {
	  if (err) {
		console.log(err);
	  }
	  res.redirect('/');
	});
  });


  // Delete conversation
router.delete('/conversations/:id', async (req, res) => {
	try {
	  const deletedConv = await Conversation.findByIdAndDelete(req.params.id);
	  if (!deletedConv) {
		return res.status(404).send();
	  }
	  res.send(deletedConv);
	} catch (error) {
	  res.status(500).send(error);
	}
  });
  

app.use('/', router);

app.listen(3000, () => {
	console.log("Listening on port 3000");
});


