'use strict';

angular.module('MorpionSolitaire', ['ServiceManagerAngularTools'])
.controller('GameController', function($scope, $q, $timeout, $window, dictionary, dialog, server)
{
	const __boardSize = 30;
	const __gridSize = 20;
	const __gridOffset = 10;
	const __gridLine = __gridSize / 2;
	const __canvasSize = __boardSize * __gridSize + 1;
	const __lineMax = 4;
	const __dirUpLeft = 0;
	const __dirUp = 1;
	const __dirUpRight = 2;
	const __dirLeft = 3;
	const __dirRight = 4;
	const __dirDownLeft = 5;
	const __dirDown = 6;
	const __dirDownRight = 7;
	const __line = [
		{ x: -1, y: -1, reverse: __dirDownRight },
		{ x: 0, y: -1, reverse: __dirDown },
		{ x: 1, y: -1, reverse: __dirDownLeft },
		{ x: -1, y: 0, reverse: __dirRight },
		{ x: 1, y: 0, reverse: __dirLeft },
		{ x: -1, y: 1, reverse: __dirUpRight },
		{ x: 0, y: 1, reverse: __dirUp },
		{ x: 1, y: 1, reverse: __dirUpLeft }
	];
	const __defaultBoard = parseBoard(
		  '   oooo   |'
		+ '   o  o   |'
		+ '   o  o   |'
		+ 'oooo  oooo|'
		+ 'o        o|'
		+ 'o        o|'
		+ 'oooo  oooo|'
		+ '   o  o   |'
		+ '   o  o   |'
		+ '   oooo   ');
	const statePlaceDot = 0;
	const stateLineStart = 1;
	const stateLineDraw = 2
	const stateDone = 3;

	$scope.board = angular.copy(__defaultBoard);
	$scope.data = {		
		moves: [],
		highscores: [],
		state: statePlaceDot,
		ordinal: 0,
		selectionX: null,
		selectionY: null
	};

	Math.TAU = 2 * Math.PI;
	Math.Tan16th = Math.tan(Math.PI / 8);
	Math.TanThree16th = Math.tan(3 * Math.PI / 8)

	$q.all([
		dictionary.loader,
		server.start({ webService: false })
	]).then(function()
	{

		$scope.data.languageList = dictionary.getLanguages();
		$scope.data.lang = server.readStore('lang');
		if ($scope.data.lang)
		{
			dictionary.setLang($scope.data.lang);
		}
		else
		{
			$scope.data.lang = dictionary.lang;
		}

		server.fetch('init').then(function(data)
		{
			angular.extend($scope.data, data);
			showHighscores();
			drawGrid();
		});
	}); // $q.all().then()

	$window.onbeforeunload =
		function(e)
		{
			return ($scope.data.state !== stateDone && $scope.board.lineCount > 0) ? true : null;
		};


	var board = document.getElementById('board');
	var _canvas = board.getContext('2d');

	_canvas.font = '8px Arial'
	_canvas.fillStyle = '#000';
	_canvas.lineWidth = 2;	

	$(board)
		.on('mousemove', function(event)
		{
			$scope.data.selectionX = parseInt((event.offsetX - __gridOffset) / __gridSize + 0.5);
			$scope.data.selectionY = parseInt((event.offsetY - __gridOffset) / __gridSize + 0.5);

			drawGrid();
		})
		.on('mousedown', function(event)
		{
			if (event.button === 0)
			{
				if ($scope.data.state === stateLineStart && $scope.board.grid[$scope.data.selectionY][$scope.data.selectionX] != null)
				{
					$timeout(function() {
						$scope.data.lineX = $scope.data.selectionX;
						$scope.data.lineY = $scope.data.selectionY;
						$scope.data.state = stateLineDraw;
						drawGrid();
					});
				}

				event.preventDefault();

				return false;
			} // if (event.button === 0)

			if (event.button === 2)
			{
				if ($scope.data.state === stateLineDraw)
				{
					$timeout(function()
					{
						$scope.data.state = stateLineStart;
						drawGrid();
					})
				}
				else
				{
					undo();
				}

				event.preventDefault();

				return false;
			} // if (event.button === 2)

			event.preventDefault();
			return false;

		}) // .on('mousedown')

		.on('mouseup', function(event)
		{
			if (event.button !== 0)
			{
				event.preventDefault();
				return false;
			}
			if ($scope.data.state === statePlaceDot)
			{
				if ($scope.board.grid[$scope.data.selectionY][$scope.data.selectionX] == null)
				{
					var item = {
						x: $scope.data.selectionX,
						y: $scope.data.selectionY,
						line: [0, 0, 0, 0, 0, 0, 0, 0],
						ordinal: ++$scope.data.ordinal
					}
					$scope.board.grid[$scope.data.selectionY][$scope.data.selectionX] = $scope.board.list.length; 
					$scope.board.list.push(item);

					$timeout(function()
					{
						$scope.data.state = stateLineStart;
						drawGrid();
					});

					$scope.data.moves.push({
						dot: 1,
						x: $scope.data.selectionX,
						y: $scope.data.selectionY
					});
				}
				return;
			} // if ($scope.data.state === statePlaceDot)

			if ($scope.data.state === stateLineDraw)
			{
				var line = checkLine();

				if (line.ok)
				{
					var ix = $scope.data.lineX;
					var iy = $scope.data.lineY;

					$scope.data.moves.push({
						x: ix,
						y: iy,
						dir: line.direction
					});

					for (var i = 0; i <= __lineMax; i++)
					{
						if (i < __lineMax)
						{
							$scope.board.list[$scope.board.grid[iy][ix]].line[line.direction] = 1;
						}
						if (i > 0)
						{
							$scope.board.list[$scope.board.grid[iy][ix]].line[line.reverse] = 1;
						}

						ix += line.x;
						iy += line.y;
					}

					$timeout(function()
					{
						$scope.data.state = statePlaceDot;
						++$scope.board.lineCount;
					});
				} // if (line.ok)

				drawGrid();

				return;
			} // if ($scope.data.state === stateLineDraw)

			drawGrid();

		}); // .on('mouseup')


	$scope.finish = function()
	{
		dialog.input(
			'enter-your-name',
			checkEnter,
			server.readStore('userName')
		);

		function checkEnter(name)
		{
			if (!name)
			{
				dialog.ok('enter-your-name');
				return true;
			}

			server.writeStore('userName', name);
			server.fetch(
				'submit',
				{
					board: 0,
					dots: 5,
					moves: $scope.data.moves,
					name: name
				}
			).then(function(data)
			{
				if (data.message)
				{
					dialog.ok(data.message);
					delete data.message;
				}
				angular.extend($scope.data, data);

				var highscores = server.readStore('highscores') || [];
				var today = new Date();
				var index = -1;

				for (var i = 0; i < highscores.length; i++)
				{
					if ($scope.data.moves.length > highscores[i].moves.length)
					{
						index = i;
						break;
					}
					if (
						$scope.data.moves.length === highscores[i].moves.length
						&& $scope.data.moves.equals(highscores[i].moves)
					)
					{
						index = null;
						break;
					}
				}

				if (index === -1)
				{
					highscores.push({
						name: name,
						lineCount: parseInt($scope.data.moves.length / 2),
						date: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
						moves: $scope.data.moves
					});
				}
				else if (index !== null)
				{
					highscores.splice(
						i, 0,
						{
							name: name,
							lineCount: parseInt($scope.data.moves.length / 2),
							date: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
							moves: $scope.data.moves
						}
					)
				}

				server.writeStore('highscores', highscores);

				showHighscores();
			});

			$timeout(function()
			{
				$scope.data.state = stateDone;
				drawGrid();
			})

		} // function checkEnter()

	}; // $scope.finish()

	$scope.newGame = function()
	{
		$scope.board = angular.copy(__defaultBoard);

		$scope.data.moves = [];
		$scope.data.state = statePlaceDot;
		$scope.data.ordinal = 0;

		drawGrid();
	}; // $scope.newGame()

	$scope.setLanguage = function(lang)
	{
		dictionary.setLang(lang);
		server.writeStore('lang', lang, true);
		$scope.data.lang = lang;
	}


	function showHighscores()
	{
		var highscores = server.readStore('highscores') || [];

		for (var i = 0; i < $scope.data.highscores.length; i++)
		{
			for (var j = 0; j < highscores.length; j++)
			{
				if (
					$scope.data.highscores[i].length === highscores[j].moves.length
					&& $scope.data.highscores[i].equals(highscores[j].moves)
				)
				{
					$scope.data.highscores[i].own = true;
					break;
				}
			}
		}
	}

	function drawGrid()
	{
		_canvas.clearRect(0, 0, __canvasSize, __canvasSize);

		var dy = __gridOffset;
		var line = {
			x: 0,
			y: 0,
			ok: false
		};

		if ($scope.data.state === stateLineDraw)
		{
			line = checkLine();
		}

		for (var y = 0; y < __boardSize; y++)
		{
			var dx = __gridOffset;

			for (var x = 0; x < __boardSize; x++)
			{
				var item = $scope.board.list[$scope.board.grid[y][x]];

				if (x === $scope.data.selectionX && y === $scope.data.selectionY)
				{
					drawItem(dx, dy, item, line);
				}
				if (item != null)
				{
					defaultDot(dx, dy, item);
				}

				dx += __gridSize;
			}

			dy += __gridSize;
		} // for (__boardSize)


		function drawItem(dx, dy, item, line)
		{
			if ($scope.data.state === stateDone)
			{
				return;
			}

			if ($scope.data.state === statePlaceDot)
			{
				_canvas.beginPath();
				_canvas.fillStyle = (item == null ? '#000' : '#c00');
				_canvas.arc(dx, dy, 7, 0, Math.TAU);
				_canvas.fill();
				return;
			} // if ($scope.data.state === statePlaceDot)

			if ($scope.data.state === stateLineDraw)
			{
				_canvas.beginPath();
				_canvas.lineWidth = 3;
				_canvas.moveTo(
					$scope.data.lineX * __gridSize + __gridOffset,
					$scope.data.lineY * __gridSize + __gridOffset
				);
				_canvas.lineTo(
					($scope.data.lineX + line.x * __lineMax) * __gridSize + __gridOffset,
					($scope.data.lineY + line.y * __lineMax) * __gridSize + __gridOffset
				);
				_canvas.strokeStyle = (line.ok ? '#0a0' : '#c00');
				_canvas.stroke();
				return;
			} // if ($scope.data.state === stateLineDraw)

			_canvas.beginPath();
			_canvas.moveTo(dx - __gridLine, dy - __gridLine);
			_canvas.lineTo(dx + __gridLine, dy + __gridLine);
			_canvas.moveTo(dx - __gridLine, dy + __gridLine);
			_canvas.lineTo(dx + __gridLine, dy - __gridLine);
			_canvas.moveTo(dx - __gridLine, dy);
			_canvas.lineTo(dx + __gridLine, dy);
			_canvas.moveTo(dx, dy - __gridLine);
			_canvas.lineTo(dx, dy + __gridLine);
			_canvas.strokeStyle = (item != null ? '#0a0' : '#c00');
			_canvas.lineWidth = 3;
			_canvas.stroke();
		} // function drawItem()

		function defaultDot(dx, dy, item)
		{
			_canvas.beginPath();
			_canvas.arc(dx, dy, 7, 0, Math.TAU);
			_canvas.lineWidth = 1;
			_canvas.strokeStyle = '#000';
			_canvas.stroke();

			if (item.ordinal)
			{
				var ordinal = item.ordinal.toString();		
				_canvas.fillText(ordinal, dx - parseInt(_canvas.measureText(ordinal).width / 2), dy + 3);
			}

			_canvas.beginPath();
			_canvas.lineWidth = 3;

			if (item.line[__dirUp])
			{
				_canvas.moveTo(dx, dy - 7);
				_canvas.lineTo(dx, dy - __gridSize / 2);
			}
			if (item.line[__dirUpRight])
			{
				_canvas.moveTo(dx + 5, dy - 5);
				_canvas.lineTo(dx + __gridSize / 2, dy - __gridSize / 2);
			}
			if (item.line[__dirRight])
			{
				_canvas.moveTo(dx + 7, dy);
				_canvas.lineTo(dx + __gridSize / 2, dy);
			}
			if (item.line[__dirDownRight])
			{
				_canvas.moveTo(dx + 5, dy + 5);
				_canvas.lineTo(dx + __gridSize / 2, dy + __gridSize / 2);
			}
			if (item.line[__dirDown])
			{
				_canvas.moveTo(dx, dy + 7);
				_canvas.lineTo(dx, dy + __gridSize / 2);
			}
			if (item.line[__dirDownLeft])
			{
				_canvas.moveTo(dx - 5, dy + 5);
				_canvas.lineTo(dx - __gridSize / 2, dy + __gridSize / 2);
			}
			if (item.line[__dirLeft])
			{
				_canvas.moveTo(dx - 7, dy);
				_canvas.lineTo(dx - __gridSize / 2, dy);
			}
			if (item.line[__dirUpLeft])
			{
				_canvas.moveTo(dx - 5, dy - 5);
				_canvas.lineTo(dx - __gridSize / 2, dy - __gridSize / 2);
			}
			_canvas.stroke();
		} // function defaultDot()

	} // function drawGrid()

	function undo()
	{
		if ($scope.data.moves.length === 0)
		{
			return;
		}

		var undo = $scope.data.moves.pop();

		if (undo.dot)
		{
			$scope.board.grid[undo.y][undo.x] = null;
			$scope.board.list.pop();
			$scope.data.state = statePlaceDot;
			--$scope.data.ordinal;

			drawGrid();

			return;
		}

		var line = __line[undo.dir];

		for (var i = 0; i <= __lineMax; i++)
		{
			if (i < __lineMax)
			{
				$scope.board.list[$scope.board.grid[undo.y][undo.x]].line[undo.dir] = 0;
			}
			if (i > 0)
			{
				$scope.board.list[$scope.board.grid[undo.y][undo.x]].line[line.reverse] = 0;
			}

			undo.x += line.x;
			undo.y += line.y;
		}

		$timeout(function()
		{
			$scope.data.state = stateLineStart;
			--$scope.board.lineCount;
		});

		drawGrid();

	} // function undo()

	function checkLine()
	{
		var dx = ($scope.data.selectionX - $scope.data.lineX) * __gridSize; 
		var dy = ($scope.data.selectionY - $scope.data.lineY) * __gridSize;
		var tan = (dx !== 0 ? dy / dx : dy);
		var output = {
			x: 0,
			y: 0,
			direction: 0,
			reverse: 0,
			ok: false
		};

		if (dx < 0)
		{
			if (tan > Math.TanThree16th)
			{
				output.direction = __dirUp;
				output.reverse = __dirDown;
			}
			else if (tan > Math.Tan16th)
			{
				output.direction = __dirUpLeft;
				output.reverse = __dirDownRight;
			}
			else if (tan > -Math.Tan16th)
			{
				output.direction = __dirLeft;
				output.reverse = __dirRight;
			}
			else if (tan > -Math.TanThree16th)
			{
				output.direction = __dirDownLeft;
				output.reverse = __dirUpRight
			}
			else
			{
				output.direction = __dirDown;
				output.reverse = __dirUp;
			}
		}
		else // if (dx >= 0)
		{
			if (tan > Math.TanThree16th)
			{
				output.direction = __dirDown;
				output.reverse = __dirUp;
			}
			else if (tan > Math.Tan16th)
			{
				output.direction = __dirDownRight;
				output.reverse = __dirUpLeft;
			}
			else if (tan > -Math.Tan16th)
			{
				output.direction = __dirRight;
				output.reverse = __dirLeft;
			}
			else if (tan > -Math.TanThree16th)
			{
				output.direction = __dirUpRight;
				output.reverse = __dirDownLeft;
			}
			else
			{
				output.direction = __dirUp;
				output.reverse = __dirDown;
			}
		} // if (dx >= 0)

		output.x = __line[output.direction].x;
		output.y = __line[output.direction].y;

		var ix = $scope.data.lineX;
		var iy = $scope.data.lineY;

		for (var i = 0; i <= __lineMax; i++)
		{
			if (check(ix, iy, output.direction, output.reverse, i === 0, i === __lineMax))
			{
				return output;
			}

			ix += output.x;
			iy += output.y;
		}

		output.ok = true;

		return output;

		function check(x, y, direction, reverse, first, last)
		{
			var i = $scope.board.grid[y][x];

			if (i == null)
			{
				return true;
			}

			var item = $scope.board.list[i];

			if (!last && item.line[direction])
			{
				return true;
			}
			if (!first && item.line[reverse])
			{
				return true;
			}
			return false;
		}

	} // function checkLine()

	function parseBoard(input)
	{
		var lines = input.split('|');
		var output = {
			grid: new Array(__boardSize),
			list: [],
			lineCount: 0
		};
		var y = __boardSize / 2 - parseInt(lines.length / 2 + 0.5);

		for (var i = 0; i < __boardSize; i++)
		{
			output.grid[i] = new Array(__boardSize);
		}

		for (var i = 0; i < lines.length; i++)
		{
			var chars = lines[i].split('');
			var x = __boardSize / 2 - parseInt(chars.length / 2 + 0.5);

			for (var j = 0; j < chars.length; j++)
			{
				if (chars[j] != ' ')
				{
					output.grid[y][x] = output.list.length;  
					output.list.push({
						x: x,
						y: y,
						line: [0, 0, 0, 0, 0, 0, 0, 0]
					});
				}
				++x;
			}
			++y;
		}

		return output;
	} // function parseBoard()

});