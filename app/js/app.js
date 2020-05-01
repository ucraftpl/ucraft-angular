let app = angular.module("ucraft", ["ngRoute", "ngSanitize"]);

var steemConnect = sc2.Initialize({
	app: 'ucraft.app',
	callbackURL: location.protocol + '//' + window.location.hostname,
	scope: ['vote', 'comment', 'offline']
});

var steemAccount = "ucraft";

const bots = ['steemitboard', 'a-0-0', 'steemitbd'];

app.config(['$locationProvider', function ($locationProvider) {
	$locationProvider.html5Mode(true);
	$locationProvider.hashPrefix('');
}]);

//todo: wydzielenie controllerow do oddzielnych plikow
//todo: pageinacja strony glownej
//todo: szukajka?
//todo: nesting(?) komentarzy
//todo: loadingi?

app.run(function ($rootScope, $location) {
	$rootScope.accessToken = $location.search().access_token || localStorage.getItem('sc.accessToken');
	$rootScope.expiresIn = $location.search().expires_in || localStorage.getItem('sc.expiresIn');
	$rootScope.loginURL = steemConnect.getLoginURL();
	console.log($rootScope.loginURL);

	if($location.search().access_token && $location.search().expires_in){
		localStorage.setItem('sc.accessToken', $rootScope.accessToken);
		localStorage.setItem('sc.expiresIn', $rootScope.expiresIn);
	}

	if(localStorage.getItem('sc.user') != null){
		try{
			$rootScope.user = JSON.parse(localStorage.getItem('sc.user'));
			console.log(JSON.parse(localStorage.getItem('sc.user')));
		}catch(err){
			console.log(err);
		}
	}

	if ($rootScope.accessToken) {
		steemConnect.setAccessToken($rootScope.accessToken);
		steemConnect.me(function (err, result) {
			console.log('/me', err, result);
			if (!err){
				$rootScope.user = result.account;
				localStorage.setItem('sc.user', JSON.stringify(result.account));
				console.log(result.account);
				$rootScope.metadata = JSON.stringify(result.user_metadata, null, 2);
				$rootScope.$apply();
			}
		});
	}

	$rootScope.isAuth = function() {
		return !!$rootScope.user;
	};

	$rootScope.logout = function() {
		steemConnect.revokeToken(function (err, result) {
			console.log('You successfully logged out', err, result);
			localStorage.removeItem('sc.accessToken');
			localStorage.removeItem('sc.expiresIn');
			localStorage.removeItem('sc.user');
			delete $rootScope.user;
			delete $rootScope.accessToken;
			$rootScope.$apply();
		});
	};

	$rootScope.$applyAsync();
});

app.controller('Main', function ($scope) {
	$scope.loadPosts = function () {
		console.log("Loading posts...");
		var posts = [];
		let parsed = 0;
		steem.api.getBlogEntries(steemAccount, 9999, 15, function (err, data) {
			if(err){
				console.log(err);
			}
			
			console.log(data);
			for (var i = 0; i < data.length; i++) {
				console.log(i);
				//console.log(xhr);
				let xhr = new XMLHttpRequest();
                xhr.open("GET", '/api/steemPost/@' + data[i].author + '/' + data[i].permlink, true);
                xhr.onreadystatechange = function () {
                    if (xhr.readyState === 4) {
                        console.log(xhr);
                        var result = xhr.responseText;
                        result = JSON.parse(result.toString());

                        var body = result.body;
                        if (body.length >= 500) {
                            body = body.substring(0, 499) + "... **[(Kliknij aby przeczytać cały tekst.)](blog/" + result.permlink + ")**";
                        }

                        posts.push({
                            'author': result.author,
                            'title': result.title,
                            'body': marked(body),
                            'date': dayjs(Date.parse(result.created)).format('DD.MM.YYYY HH:mm'),
							'dateInt': dayjs(Date.parse(result.created)).valueOf(),
                            'permlink': result.permlink,
                            'customAuthor': !(result.author === steemAccount)
                        });

                        parsed++;

                        if (data.length - 1 === parsed) {
                            posts.sort(function (a, b) {
                                return b.dateInt - a.dateInt
                            });
                            console.log(posts);
                            $scope.posts = posts;
                            $scope.$applyAsync();
                        }
					}
                };
                xhr.send();
			}
		});
	};
});

app.controller("PostController", function ($scope, $rootScope, $routeParams) {
	$scope.postAuthor = steemAccount;
	$scope.commentsLoaded = false;

	if($routeParams.author){
		$scope.postAuthor = $routeParams.author;
	}
	$scope.loadPost = function () {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", '/api/steemPost/@' + $scope.postAuthor + '/' + $routeParams.permlink, true);
        xhr.onreadystatechange = function () {
        	if(this.status === 404){
        		$scope.notFound = true;
        		$scope.$applyAsync();
        		return;
			}
            var result = xhr.responseText;
            result = JSON.parse(result);
            $scope.post = {
            	'author': result.author,
				'title': result.title,
				'body': marked(result.body),
				'date': dayjs(Date.parse(result.created)).format('DD.MM.YYYY HH:mm'),
				'permlink': result.permlink
            };
            $scope.$applyAsync();
        };
        xhr.send();
	};

	$scope.loadComments = function () {
		steem.api.getContentReplies($scope.postAuthor, $routeParams.permlink, function (err, result) {
			if (!err) {
				var comments = [];
				var commentsProcessed = 0;
				console.log(result);
				if(result.length === 0){
					$scope.comments = comments;
					$scope.commentsLoaded = true;
					$scope.$applyAsync();
				}
				result.forEach(function(element) {
					console.log(element);
					commentsProcessed++;
					if(!bots.includes(element.author)){
						comments.push(element);
					}
					if(commentsProcessed === result.length){
						$scope.comments = comments.slice(-25).reverse();
						$scope.commentsLoaded = true;
						$scope.$applyAsync();
					}
				});
			}
		})
	};

	$scope.vote = function(author, permlink, weight) {
		steemConnect.vote($scope.user.name, author, permlink, weight, function (err, result) {
			if (!err) {
				console.log('You successfully voted for @' + author + '/' + permlink, err, result);
				$scope.loadComments();
			} else {
				console.log(err);
			}
		});
	};

	$scope.comment = function() {
		$scope.loading = true;
		var permlink = steem.formatter.commentPermlink($scope.postAuthor, $routeParams.permlink);
		steemConnect.comment($scope.postAuthor, $routeParams.permlink, $scope.user.name, permlink, '', $scope.message, '', function(err, result) {
			console.log(err, result);
			$scope.message = '';
			$scope.loading = false;
			$scope.$apply();
			$scope.loadComments();
		});
	};

	$scope.commentGuest = function(){ //todo: WIP function, api not complete.
	    $scope.loading = true;
        var permlink = steem.formatter.commentPermlink($scope.postAuthor, $routeParams.permlink);
        var xhr = new XMLHttpRequest();
        //xhr.open("POST", 'http://guest-post.ucraft.pl/comment', true);
        xhr.open("POST", 'http://localhost:3000/comment', true);
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

        xhr.onreadystatechange = function() { // Call a function when the state changes.
            if (this.status === 200) {
                $scope.message = '';
                $scope.loading = false;
                $scope.$apply();
                $scope.loadComments();
            }else{
				alert("Coś poszło nie tak.");
                $scope.loading = false;
                $scope.$apply();
                $scope.loadComments();
			}
        };
        //coinhive-captcha-token - hidden input.
        xhr.send("author=" + $scope.postAuthor + "&permlink=" + $routeParams.permlink + "&nickname=" + $scope.nickname + "&comment=" + $scope.message + "&coinhive=1");
	};

	$scope.fixCoinhiveCaptcha = function(){
        CoinHive.Captcha.ElementsCreated = false;
        CoinHive.Captcha.CreateElements();
    };
});

app.config(function ($routeProvider) {
	$routeProvider
		.when("/", {
			controller: "Main",
			templateUrl: "app/views/index.html"
		})
		.when("/profile", {
			templateUrl: "app/views/profile.html"
		})
		.when("/sklep", {
			templateUrl: "app/views/sklep.html"
		})
		.when("/unban", {
			templateUrl: "app/views/unban.html"
		})
		.when("/skarga", {
			templateUrl: "app/views/skarga.html"
		})
        .when("/api", {
            templateUrl: "app/views/api.html"
        })
		.when("/blog/:permlink", {
			controller: "PostController",
			templateUrl: "app/views/blogPost.html"
		})
		.when("/blog/@:author/:permlink", {
			controller: "PostController",
			templateUrl: "app/views/blogPost.html"
		})
		.otherwise({
			templateUrl: 'app/404.html'
		});
});