const express = require('express');
const session = require('express-session');
const hbs = require('express-handlebars');
const mongoose = require('mongoose');
const passport = require('passport');
const localStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const app = express();
const router = express.Router();


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
app.engine('hbs', hbs({
	extname: '.hbs',
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

app.get('/conversations', isLoggedIn, function (req, res) {
	Conversation.find().then(function (conversations) {
		res.render('conversations', { title: "Conversation", conversations: conversations });
	}).catch(function (error) {
		console.log(error);
		res.status(500).send('Internal Server Error');
	});
});

app.get('/questions', isLoggedIn, function (req, res) {
	question.find({}).then(function (questions) {
		res.render('questions', { title: "Q/R", questions: questions });
	}).catch(function (error) {
		console.log(error);
		res.status(500).send('Internal Server Error');
	});
}); 


app.get('/NewQuestion', isLoggedIn, function (req, res) {
    res.render('newQuestion', { title: "New Question" });
});

app.post('/questions', isLoggedIn, function (req, res) {
	const { tag, patterns, responses } = req.body;
  
	const newQuestion = new question({
	  intents: [{
		tag: tag,
		patterns: patterns.split("\n").map((pattern) => pattern.trim()), 
		responses: responses.split("\n").map((response) => response.trim()) 
	  }]
	});
  
	newQuestion.save()
	  .then(() => {
		res.redirect('/questions');
	  })
	  .catch(error => {
		console.log(error);
		res.status(500).send('Internal Server Error');
	  });
  });
  

app.get('/tags/:id', isLoggedIn, async (req, res) => {
	const questionId = req.params.id;
  
	// Validate the questionId as a valid ObjectId
	if (!mongoose.Types.ObjectId.isValid(questionId)) {
	  console.error('Invalid question ID:', questionId);
	  res.sendStatus(400);
	  return;
	}
  
	console.log('Received question ID:', questionId);
  
	try {
	  const foundQuestion = await question.findById(questionId).lean();
  
	  if (!foundQuestion) {
		console.error('Question not found for _id:', questionId);
		res.sendStatus(404);
		return;
	  }
  
	  console.log('Found question:', foundQuestion);
  
	  res.render('tags', {
		title: "Tags",
		patterns: foundQuestion.intents[0].patterns,
		responses: foundQuestion.intents[0].responses,
		tagId: questionId

	  });
	} catch (error) {
	  console.error('Error occurred:', error);
	  res.sendStatus(500);
	}
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

app.get('/logout', function (req, res) {
	req.logout(function (err) {
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


// Delete Tag
app.get('/questions/:id/delete', isLoggedIn, function (req, res) {
	const intentId = req.params.id;
  
	question.findByIdAndRemove(intentId)
	  .then(() => {
		res.redirect('/questions');  
	  })
	  .catch(error => {
		console.log(error);
		res.status(500).send('Internal Server Error');
	  });
  });
   
  app.delete('/tags/:id/patterns/:p', isLoggedIn, async (req, res) => {
	const tagId = req.params.id;
	const pattern = req.params.p;
  
	if (!mongoose.Types.ObjectId.isValid(tagId)) {
	  console.error('Invalid question ID:', tagId);
	  res.sendStatus(400);
	  return;
	}
  
	console.log('Received question ID:', tagId);
  
	try {
	  const foundQuestion = await question.findById(tagId);
  
	  if (!foundQuestion) {
		console.error('Question not found for _id:', tagId);
		res.sendStatus(404);
		return;
	  }
  
	  const index = foundQuestion.intents[0].patterns.findIndex(el => el == pattern);
	  if (index != -1 )
	  foundQuestion.intents[0].patterns.splice(index, 1);
  

	  await foundQuestion.save();
  
	  res.sendStatus(200);
	} catch (error) {
	  console.error('Error occurred:', error);
	  res.sendStatus(500);
	}
  });

  app.delete('/tags/:id/responses/:r', isLoggedIn, async (req, res) => {
	const tagId = req.params.id;
	const response = req.params.r;
  
	
	if (!mongoose.Types.ObjectId.isValid(tagId)) {
	  console.error('Invalid tag ID:', tagId);
	  res.sendStatus(400);
	  return;
	}
  
	console.log('Received tag ID:', tagId);
  
	try {
	  const foundQuestion = await question.findById(tagId);
  
	  if (!foundQuestion) {
		console.error('Tag not found for _id:', tagId);
		res.sendStatus(404);
		return;
	  }
  
	 
	  const index = foundQuestion.intents[0].responses.findIndex(el => el == response);
	  if (index != -1)
	  foundQuestion.intents[0].responses.splice(index, 1);
  
	  // Save the updated tag
	  await foundQuestion.save();
  
	  res.sendStatus(200);
	} catch (error) {
	  console.error('Error occurred:', error);
	  res.sendStatus(500);
	}
  });
    

  app.post('/tags/:id/patterns', isLoggedIn, async (req, res) => {
	const tagId = req.params.id;
	const pattern = req.body.pattern;
  
	
	if (!mongoose.Types.ObjectId.isValid(tagId)) {
	  console.error('Invalid tag ID:', tagId);
	  return res.sendStatus(400);
	}
  
	console.log('Received tag ID:', tagId);
  
	try {
	  const foundQuestion = await question.findById(tagId);
  
	  if (!foundQuestion) {
		console.error('Tag not found for _id:', tagId);
		return res.sendStatus(404);
	  }
  
	  // Initialize patterns array if it doesn't exist
	  if (!foundQuestion.patterns) {
		foundQuestion.patterns = [];
	  }
  
	  foundQuestion.intents[0].patterns.push(pattern);
  
	  await foundQuestion.save();
  
	  res.sendStatus(200);
	} catch (error) {
	  console.error('Error occurred:', error);
	  res.sendStatus(500);
	}
  });

  app.post('/tags/:id/responses', isLoggedIn, async (req, res) => {
	const tagId = req.params.id;
	const response = req.body.response;
  
	if (!mongoose.Types.ObjectId.isValid(tagId)) {
	  console.error('Invalid tag ID:', tagId);
	  return res.sendStatus(400);
	}
  
	console.log('Received tag ID:', tagId);
  
	try {
	  const foundQuestion = await question.findById(tagId);
  
	  if (!foundQuestion) {
		console.error('Tag not found for _id:', tagId);
		return res.sendStatus(404);
	  }
  
	  
	  if (!foundQuestion.responses) {
		foundQuestion.responses = [];
	  }
  
	  foundQuestion.intents[0].responses.push(response);
  
	  await foundQuestion.save();
  
	  res.sendStatus(200);
	} catch (error) {
	  console.error('Error occurred:', error);
	  res.sendStatus(500);
	}
  });
  
   
app.use('/', router);


app.listen(3000, () => {
	console.log("Listening on port 3000");
});
  