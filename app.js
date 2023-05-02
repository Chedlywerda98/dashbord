const express			= require('express');
const session			= require('express-session');
const hbs				= require('express-handlebars');
const mongoose			= require('mongoose');
const passport			= require('passport');
const localStrategy		= require('passport-local').Strategy;
const bcrypt			= require('bcrypt');
const app				= express();

mongoose.connect("mongodb+srv://chedlywerda:oIDqDC7FfNABYLlV@cluster0.fjsrksp.mongodb.net/ChatBot",
 { useNewUrlParser: true, useUnifiedTopology: true })
   .catch((error) => {
    console.log("Error connecting to MongoDB Atlas: " + error);
  });

const db = mongoose.connection;

db.once("open", () => {
  console.log("Connected to MongoDB database 'test'");
});

db.on("error", (error) => {
  console.log("MongoDB connection error: " + error);
});


const users = mongoose.model('Users',{
	username: {
		type: String,
		required: true
	},
	password: {
		type: String,
		required: true
	}
});



// Middleware
app.engine('hbs', hbs({ extname: '.hbs' }));
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
	  .then(function(users) {
		done(null, users);
	  })
	  .catch(function(err) {
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
	res.render("index", { title: "home" });
});

app.get('/about',isLoggedIn, (req, res) => {
	res.render("index", { title: "About" });
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
  



app.listen(3000, () => {
	console.log("Listening on port 3000");
});