(function ($) { // vamos implementar nosso jogo como um plugin jQuery, envolvê-lo em um módulo para limitar o escopo e evitar conflitos

var settings;

var ShipRotation = { // objeto de enumeração do estado de rotação do navio
    HORIZONTAL: 0,
    VERTICAL: 1
};

var TurnResult = { // acertar o objeto e num do resultado
    MISSED: 0,
    HIT: 1,
    KILLED: 2,
    VICTORY: 3
}

var CellOccupationType = { // objeto de enumeração de ocupação de célula
    FREE: 0, // célula livre
    OCCUPIED: 1, // a célula é ocupada por um navio
    UNAVAILABLE: 2 // uma célula adjacente à nave (nenhuma nova nave pode ser colocada nela)
}

var CellHitType = { // objeto de enumeração do estado de acerto da célula
    NONE: 0, // nenhum tiro foi disparado contra a celula
    MISSED: 1, // eles atiraram na célula, mas não atingiram o navio
    HIT: 2, // eles atiraram na célula, eles atingiram o navio
    KILLED: 3 // eles atiraram na cela, o navio foi afundado
}

function bind(func, context) { // função para ligação de contexto
  return function() { 
    return func.apply(context, arguments);
  };
}

function getRandomInt(min, max) { //função para obter um inteiro aleatório em um determinado intervalo
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function BattleShip (size, rotation) { // construtor de navio
    this.rotation = rotation; // posição do navio (vertical ou horizontal)
    this.size = size; // tamanho da célula
    this.coords = new Array(); // todas as coordenadas onde o navio está localizado
    
    var health = size; // "saúde" do navio - quantas células permaneceram inalteradas
    var isFlipped = false; // o navio afundou
    this.isFlipped = function () { // getter para isFlipped (para que você não possa alterar manualmente esse valor - ele é alterado apenas pela função flip)
        return isFlipped;
    }
    var isAlive = true; // o navio está vivo
    this.isAlive = function () { // getter
        return isAlive;
    }
    
    this.hit = function () { // função de acertar a nave: tira uma unidade de "saúde" (uma célula foi atingida) e se todas as células da nave forem atingidas - configura a variável isAlive para false
        if (--health <= 0) {
            isAlive = false;
        }
        return isAlive;
    }
    
    this.flip = function () { // função de virar o navio (caso o navio não caiba no campo na posição inicial)
        if (this.rotation == 0) {
            this.rotation = 1;
        } else {
            this.rotation = 0;
        }
        isFlipped = true;
    }
}

function coordsSum(coord1, coord2) { // função de soma de coordenadas
    return { x: coord1.x + coord2.x, y : coord1.y + coord2.y };
}

function coordsMult(coords, num) { // função de multiplicar todas as coordenadas por um número
    var result = new Array();
    for (var i = 0; i < coords.length; i++) {
        result.push({ x: coords[i].x * num, y: coords[i].y * num });
    }
    return result;
}

function ComputerAI(playerField) { // конструктор объекта компьютерного противника
    var lastShot = null; // здесь будет хранитсья координата последнего попадания
    var initHit = null; // здесь будет храниться координата, по которой впервые попали по кораблю
    var foundShipDirection = false; // определено ли направление поворота корабля
    var shootBackward = false; // следует ли стрелять в обратном направлении (если следуя по координатам корабля, он вдруг закончился)
    var shootAroundTryCount = -1; // число попытока обстрела соседних с кораблем клеток
    var coordsToTry = [{ x: 0, y: 1 }, // "вектора" для обстрела соседних клеток
                       { x: 0, y: -1 },
                       { x: 1, y: 0 },
                       { x: -1, y: 0 }];
    
    this.takeTurn = function() { // компьютер делает ход
        var coords; // координаты для обстрела
        
        if (lastShot == null) { // если мы еще ни в кого не попали, стреляем в случайную клетку
            coords = playerField.getNextUnhitCoords(getRandomInt(1, settings.fieldWidth), getRandomInt(1, settings.fieldHeight));
        } else {
            if (shootBackward) { // если следует продолжать обстрел в обратном направлении (данные для этого вычислены на предыдущем ходу)
                coords = coordsSum(lastShot, coordsToTry[shootAroundTryCount]);
            } else if (foundShipDirection) { // если найдено направление, в котором следует обстреливать корабль
                coords = coordsSum(lastShot, coordsToTry[shootAroundTryCount]);
                // проверка на выход за пределы поля:
                if (verifyCoords(coords, playerField)) { // если вышли за пределы поля - "разворачиваем" наши вектора для обстрела
                    coords = coordsSum(initHit, coordsToTry[shootAroundTryCount]);
                }
            } else do { // если направление для обстрела не найдено, но на предыдущем ходу мы в кого-то попали, пытаемся найти направление, в котором следует продолжать обстрел
                shootAroundTryCount++;
                coords = coordsSum(lastShot, coordsToTry[shootAroundTryCount]); // находим координату вокруг последнего попадания
            } while (verifyCoords(coords, playerField)) // проверка на допустимость полученных координат
        }
        
        var turnResult = playerField.hit(coords.x, coords.y); // совершаем выстрел и смотрим результаты
        if (turnResult == TurnResult.HIT) { // если попали в кого-то
            if (lastShot != null) { // если до этого уже попадали в этот корабль, записываем, что нашли направление для дальнейшей стрельбы
                foundShipDirection = true;
            } else { // если не попадали - сохраняем место первого попадания по этому кораблю
                initHit = coords;
            }
            lastShot = coords; // сохраняем место последнего попадания по кораблю
        } else if (turnResult == TurnResult.KILLED) { // если убили корабль - сбрасываем все что запомнили
            lastShot = null;
            shootAroundTryCount = -1;
            foundShipDirection = false;
            shootBackward = false;
            initHit = null;
        } else if (foundShipDirection && turnResult == TurnResult.MISSED) { // если мы стреляли по направлению корабля, но он вдруг закончился - значит, надо стрелять по нему с другой стороны
            shootBackward = true; // сохраняем, что надо на следующем ходу стрелять с другой стороны
            lastShot = initHit; // и что надо начать стрелять с того места, в которое попали первый раз
            coordsToTry = coordsMult(coordsToTry, -1); // "разворачиваем" вектора стрельбы
        }
        
        return turnResult; // возвращаем результаты выстрела
    }
    
    function verifyCoords(coords, gameField) { // функция проверки координат на возможность стрельбы
        return coords.x < 1 || coords.x > settings.fieldWidth || coords.y < 1 || coords.y > settings.fieldHeight
                    || gameField.getCellInCoords(coords.x, coords.y).getHitState() != CellHitType.NONE;
    }
}

function GameManager(gameBoard, playerName) { // construtor de objetos de controle de jogo
    var isPlayerTurn = true;
    var computerAI, playerField, computerField;
    
    function switchTurn () { //comutação de curso
        isPlayerTurn = !isPlayerTurn;
        this.makeTurn();
    }
    
    this.startGame = function () { // começo do jogo
        playerField = new GameFieldManager(true); // criar campos de jogo
        computerField = new GameFieldManager(false);
        
        generateShips(playerField); // gerar navios nos campos
        generateShips(computerField);
        
        computerAI = new ComputerAI(playerField); // crie um objeto de um oponente de computador (se você alterar um pouco o código do GameManager, poderá fazer o computador jogar consigo mesmo :)
        //computerAI2 = new ComputerAI(computerField);
        
        playerField.fieldCaption.append("<span>Sua vez, Player2:</span>"); // preencha o cabeçalho das tabelas
        computerField.fieldCaption.append("<span>Sua vez, " + playerName + ":</span>");
        
        gameBoard.append(playerField.getFieldDiv()); // colocamos os campos de jogo gerados na div do nosso plugin
        gameBoard.append(computerField.getFieldDiv());
        
        this.makeTurn();
    }
    
    function restartGame() { // recurso de reinício do jogo
        gameBoard.empty();
        this.startGame();
    }
    
    this.makeTurn = function () { // mover a função de execução
        if (isPlayerTurn) {
            // altere a interface para exibir de quem é a vez
            playerField.fieldCaption.css("visibility", "hidden");
            computerField.fieldCaption.css("visibility", "visible");
            playerField.getFieldDiv().removeClass("game-field-active");
            computerField.getFieldDiv().addClass("game-field-active");
            computerField.bindClickEvents(bind(cellClicked, this)); // habilitar manipuladores de clique para células de campo
            //setTimeout(bind(function () { computerTurn(computerAI2, this); }, this), settings.computerWaitTime);
        } else {
            playerField.fieldCaption.css("visibility", "visible");
            computerField.fieldCaption.css("visibility", "hidden");
            playerField.getFieldDiv().addClass("game-field-active");
            computerField.getFieldDiv().removeClass("game-field-active");
            computerField.unBindClickEvents(); // desabilitar manipuladores de clique em células de campo
            
            setTimeout(bind(function () { computerTurn(computerAI, this); }, this), settings.computerWaitTime); // faça uma pequena pausa e deixe o computador fazer o seu movimento
        }
    }
    
    function computerTurn(computer, me) { // a função de fazer um movimento pelo computador e processar seus resultados
        switch (computer.takeTurn()) {
            case TurnResult.MISSED: // se você errar - passe a jogada para o jogador
                switchTurn.call(me)
                break
            case TurnResult.HIT: // se você acertar ou matar - faça uma pausa e solte o computador novamente
                setTimeout(function () { computerTurn(computer, me); }, settings.computerWaitTime)
                break
            case TurnResult.KILLED:
                setTimeout(function () { computerTurn(computer, me); }, settings.computerWaitTime)
                break
            case TurnResult.VICTORY: // se o computador ganhou - nós contamos ao jogador sobre isso
                restartGame.call(me)
                break
            default:
                console.log("Error: Unexpected value") // para contingências
        }
    }
    
    function cellClicked (event) { // manipulador de eventos para clicar em uma célula do campo de jogo (o mesmo que para o computador, mas apenas para o jogador)
        switch (computerField.hit(event.data.x, event.data.y)) {
            case TurnResult.MISSED:
                switchTurn.call(this)
                break
            case TurnResult.HIT:
                break
            case TurnResult.KILLED:
                break
            case TurnResult.VICTORY:
                restartGame.call(this)
                break
            default:
                console.log("Error: Unexpected value")
        }
    }
}

function GameFieldManager (isPlayer) { // construtor de objetos para trabalhar com o campo de jogo (o parâmetro indica se o campo que está sendo criado é o campo do jogador ou o campo do computador)
    var gameField = new Array(settings.fieldHeight); // array para armazenar referências a objetos jQuery (células do campo de jogo)
    this.fieldCaption = $("<div>").addClass("game-field-caption"); // título do campo
    
    this.getCellInCoords = function (x, y) { // função para obter o objeto da célula por coordenadas
        if (x > 0 && x <= settings.fieldWidth && y > 0 && y <= settings.fieldHeight) {
            return gameField[x][y];
        }
        else return new FieldCell(-1, -1, null); // se as coordenadas estiverem incorretas, retornaremos a célula "inexistente", qualquer manipulação com ela não afetará o jogo de forma alguma
    }
    
    function getCellsAroundCoords(x, y, fieldManager) { // função para obter todas as células ao redor da célula com coordenadas xey
        return [fieldManager.getCellInCoords(x - 1, y),
                fieldManager.getCellInCoords(x - 1, y - 1),
                fieldManager.getCellInCoords(x - 1, y + 1),
                fieldManager.getCellInCoords(x, y + 1),
                fieldManager.getCellInCoords(x, y - 1),
                fieldManager.getCellInCoords(x + 1, y),
                fieldManager.getCellInCoords(x + 1, y + 1),
                fieldManager.getCellInCoords(x + 1, y - 1)];
    }
    
    var shipsOnField = new Array(); // array para armazenamento de navios no campo
    
    function addShip(ship) { // a função de adicionar um navio ao campo
        for (var ci = 0; ci < ship.coords.length; ci++) { // passe por todas as coordenadas da nave, marque as células correspondentes da nave como ocupadas e as células ao seu redor como inacessíveis para colocar novas naves nelas
            var c = ship.coords[ci];
            this.getCellInCoords(c.x, c.y).occupy();
            var cellsAround = getCellsAroundCoords(c.x, c.y , this);
            for (var i = 0; i < cellsAround.length; i++) {
                cellsAround[i].reserv();
            }
        }
        
        shipsOnField.push(ship); //adicione o navio ao array para acesso subsequente a ele
    }
        
    
    this.getFieldDiv = function () { // getter de um objeto de tabela com um campo (o próprio objeto é privado para nós)
        return _$fieldDiv;
    }
    
    function getNextFreeCoords(initX, initY, maxX, maxY) { // função wrapper para obter as próximas coordenadas desocupadas após as especificadas (se as coordenadas especificadas estiverem livres, ele as retornará)
        return getNextCoords(initX, initY, maxX, maxY, true);
    }
    
    this.getNextUnhitCoords = function(initX, initY) { // função wrapper para obter as próximas coordenadas não disparadas após as especificadas (se as coordenadas especificadas não forem disparadas, ela as retornará)
        return getNextCoords(initX, initY, settings.fieldWidth, settings.fieldHeight, false);
    }
    
    function getNextCoords(initX, initY, maxX, maxY, isFindFree) { // função para obter as seguintes coordenadas, de acordo com um dos dois critérios (livre ou não disparado)
        var curX = initX;
        var curY = initY;
        if (curX > maxX) {
            curX = 1;
            if (++curY > maxY) {
                curY = 1;
            } 
        } else if (curY > maxY) {
            curY = 1;
            curX = 1;
        }
        
        while (isFindFree
               ? gameField[curX][curY].getOccupationState() != CellOccupationType.FREE
               : gameField[curX][curY].getHitState() != CellHitType.NONE)
        {
            if (++curX > maxX) {
                if (++curY > maxY) {
                    curY = 1;
                }
                curX = 1;
            }
            if (curX == initX && curY == initY) {
                console.log("No free space found");
                return null;
            }
        }
        return {x: curX, y: curY};
    }
    
    this.putShipRandom = function (ship) { // função de colocar o navio em um lugar aleatório
        var isHor = Number(ship.rotation == ShipRotation.HORIZONTAL);
        var isVert = Number(ship.rotation == ShipRotation.VERTICAL);
        var maxX = settings.fieldWidth - isHor * (ship.size - 1); // determinamos as coordenadas máximas, além das quais não faz sentido tentar colocar o navio (ele irá além dos limites do campo)
        var maxY = settings.fieldHeight - isVert * (ship.size - 1);
        
        var randX = getRandomInt(1, maxX); // obter coordenadas aleatórias
        var randY = getRandomInt(1, maxY);
        var foundRoom = false; // você encontrou um lugar
        var foundCoords; // coordenadas encontradas
        var startX = randX; // salve as coordenadas geradas originalmente, para detectar looping ao procurar um lugar
        var startY = randY;
        
        while (!foundRoom) {
            foundCoords = new Array();
            var tmpFirstCoord = getNextFreeCoords(startX, startY, maxX, maxY);
            if (tmpFirstCoord == null) return;
            
            foundCoords.push(tmpFirstCoord); // encontramos algumas coordenadas, agora vamos verificar se a nave caberá ali
            foundRoom = true;
            for (var i = 1; i < ship.size; i++) { // vamos passar por todas as coordenadas do navio
                var tmpX = tmpFirstCoord.x + i * isHor;
                var tmpY = tmpFirstCoord.y + i * isVert;
                if (gameField[tmpX][tmpY].getOccupationState() == CellOccupationType.FREE) { // verifique se a cela em que estamos tentando colocar o navio está ocupada
                    foundCoords.push({x:tmpX, y:tmpY}); // se não, salve as coordenadas
                }
                else { // caso contrário - vá para a próxima célula
                    if (++startX > maxX) {
                        if (++startY > maxY) {
                            startY = 1;
                        }
                        startX = 1;
                    }
                    foundRoom = false;
                    break;
                }
            }
            if (!foundRoom && startX == randX && startY == randY) { // se você andou por todo o campo, mas não encontrou um lugar
                if (ship.isFlipped()) { // se o navio já foi virado uma vez, dizemos que não havia lugar (isso não pode estar nas regras clássicas da Batalha Naval)
                    console.log("Not enought free space for the ship");
                    return;
                }
                ship.flip(); // viramos o navio e tentamos encontrar um lugar para ele no campo novamente
                isHor = Number(ship.rotation == ShipRotation.HORIZONTAL);
                isVert = Number(ship.rotation == ShipRotation.VERTICAL);
                maxX = settings.fieldWidth - isHor * (ship.size - 1);
                maxY = settings.fieldHeight - isVert * (ship.size - 1);
            }
        }
        
        ship.coords = foundCoords; // quando encontramos um lugar para nosso navio, salvamos suas coordenadas do navio
        addShip.call(this, ship);  // e adicione-o ao campo
    }
    
    function getShipInCoords(x, y) { // função para obter o navio localizado nas coordenadas fornecidas
        for (var s = 0; s < shipsOnField.length; s++) {
            for (var c = 0; c < shipsOnField[s].coords.length; c++) {
                if (shipsOnField[s].coords[c].x == x && shipsOnField[s].coords[c].y == y) {
                    return shipsOnField[s];
                }
            }
        }
        
        return null;
    }
    
    this.hit = function (x, y) { // função de reação para acertar na célula do campo de jogo
        gameField[x][y].hit(); // desencadear uma reação na própria célula
        var shipInCoords = getShipInCoords(x, y); // verifique se há um navio no local onde batemos
        if (shipInCoords != null) {
            if (!shipInCoords.hit()) { // se havia um navio na gaiola, verifique se ele foi morto
                for (var ci = 0; ci < shipInCoords.coords.length; ci++) { // vamos passar por todas as coordenadas da nave, marcar as células ao redor dela como atingidas - para que fique claro que não faz sentido atirar nelas
                    var c = shipInCoords.coords[ci];
                    this.getCellInCoords(c.x, c.y).hit(); 
                    var cellsAround = getCellsAroundCoords(c.x, c.y, this);
                    for (var i = 0; i < cellsAround.length; i++) {
                        cellsAround[i].hit();
                    }
                }
                // verifique a vitória
                var isVictory = true;
                for (var s = 0; s < shipsOnField.length; s++) { // verifique o status de todos os navios
                    if (shipsOnField[s].isAlive()) {
                        isVictory = false;
                        break;
                    }
                }
                if (isVictory) {
                    if (!isPlayer) {
                        alert("Вы выиграли! :)"); // se razgorm no campo do adversário - então o jogador ganhou
                    } else {
                        alert("Вы проиграли! :("); // se no campo do jogador - o jogador perdeu
                    }
                    return TurnResult.VICTORY;
                }
                return TurnResult.KILLED;
            }
            return TurnResult.HIT;
        } else {                  
            return TurnResult.MISSED;
        }
    }
    
    this.bindClickEvents = function (clickEvent) { // vincular o manipulador de eventos de clique da célula a todas as células
        if (isPlayer) return; // certifique-se de que esta função não seja chamada no campo do jogador
        
        for (var i = 1; i < gameField.length; i++) {
            for (var j = 1; j < gameField[i].length; j++) {
                gameField[i][j].bindClickEvent(clickEvent);
            }
        }
    }
    
    this.unBindClickEvents = function () { // desvincular o manipulador de eventos de clique da célula para todas as células
        if (isPlayer) return;
        
        for (var i = 1; i < gameField.length; i++) {
            for (var j = 1; j < gameField[i].length; j++) {
                gameField[i][j].unBindClickEvent();
            }
        }
    }
    
    function FieldCell(x, y, jqObject) { // construtor de objeto de célula
        this.cellObject = jqObject; //objeto de célula jQuery
        
        var hitState = CellHitType.NONE; // estado de acerto da célula
        var occupationState = CellOccupationType.FREE; // status da célula (se ocupado)
        
        this.getOccupationState = function () {
            return occupationState;
        }
        
        this.getHitState = function () {
            return hitState;
        }
        
        this.occupy = function () { // marque a célula como ocupada e mostre a nave se a ação ocorrer no campo do jogador
            occupationState = CellOccupationType.OCCUPIED;
            if (isPlayer) showShip(this);
        }
        
        this.reserv = function () { // marcar a célula como inacessível para colocar novas naves nela
            if (occupationState != CellOccupationType.OCCUPIED) {
                occupationState = CellOccupationType.UNAVAILABLE;
            }
        }
        
        function hitEffectRemove() { // remover efeito de acerto
            if (occupationState == CellOccupationType.OCCUPIED) {
                this.cellObject.removeClass("game-field-cell-hit-effect");
                this.cellObject.addClass("game-field-cell-hit");
            } else {
                this.cellObject.removeClass("game-field-cell-missed-effect");
                this.cellObject.addClass("game-field-cell-missed");
            }
        }
        
        this.hit = function () { // função de acerto da célula
            if (hitState != CellHitType.NONE || this.cellObject == null) return;
            
            if (occupationState == CellOccupationType.OCCUPIED) {
                hitState = CellHitType.HIT;
                this.cellObject.removeClass("game-field-cell-with-ship");
                this.cellObject.addClass("game-field-cell-hit-effect");
            } else {
                hitState = CellHitType.MISSED;
                this.cellObject.addClass("game-field-cell-missed-effect");
            }
            setTimeout(bind(hitEffectRemove, this), 1000);
            
            this.unBindClickEvent();
        }
        
        this.bindClickEvent = function (clickEvent) { // vincular o manipulador de eventos click à célula atual
            if (hitState != CellHitType.NONE || this.cellObject == null) return;
            
            this.cellObject.addClass("game-field-cell-clickable");
            this.cellObject.on("click", { // ligando um evento a uma célula
                    x: x, // localização da célula na tabela
                    y: y
                }, clickEvent);
        }
        
        this.unBindClickEvent = function () { // desvincular o manipulador de eventos de clique da célula atual
            this.cellObject.removeClass("game-field-cell-clickable");
            this.cellObject.off("click");
        }
        
        function showShip (me) { // exibir o navio no campo
            me.cellObject.addClass("game-field-cell-with-ship");
        }
    }
    
    var _$fieldDiv = (function() { // esta função será executada assim que um novo objeto GameFieldManager for criado e gerar o campo de jogo
        var $fieldDiv = $("<div>").addClass("game-field"); // crie um objeto de tabela jQuery para o playfield
        $fieldDiv.append(this.fieldCaption);
        var initCharCode = "А".charCodeAt(0); // obtemos o código do caractere da letra A, para gerar
        var charToSkipCharCode = "Й".charCodeAt(0); // código da letra Y, para ignorá-lo
        
        for (var i = 0; i <settings.fieldHeight + 1; i++) { // ciclo de geração de linhas da tabela
            var $tableRow = $("<div>"); // criar uma cadeia
            if (i == 0) {
                $tableRow.addClass("game-field-letters-row"); // se a linha for a primeira - defina a classe para a primeira linha
            } else {
                $tableRow.addClass("game-field-row"); // caso contrário - classe de string simples
            }
            
            for (var j = 0; j <settings.fieldWidth + 1; j++) { // loop de geração de células para tabela
                var $tableCell = $("<div>"); // criar uma célula
                if (i == 0 || j == 0) {
                    $tableCell.addClass("game-field-headers-cell"); // se a célula for a primeira de uma coluna ou linha, atribuímos a ela uma classe de células com numeração
                    if (i == 0 && j != 0) { // se a célula for a primeira da coluna, preencha-a com uma letra ordinal
                        var currentCharCode = initCharCode + j;
                        $tableCell.text(String.fromCharCode(currentCharCode - (currentCharCode <= charToSkipCharCode ? 1 : 0))); // em uma string - marque para pular a letra Y
                    } else if (i != 0 && j == 0) { // se a célula for a primeira da linha, preencha-a com um número de série
                        $tableCell.text(i);
                    }
                } else {
                    $tableCell.addClass("game-field-cell"); // se a célula fizer parte do campo de jogo - atribua a classe apropriada
                }
                if (i != 0 && j != 0) { // adicione as células do campo de jogo à matriz
                    if (i == 1) {
                        gameField[j] = new Array(settings.fieldWidth); // inicializar uma nova string no array
                    }
                    gameField[j][i] = new FieldCell(j, i, $tableCell); // salve o objeto da célula em uma matriz para acesso posterior
                }
                $tableRow.append($tableCell); // adicionar células geradas à linha da tabela
            }
            $fieldDiv.append($tableRow); // adicionar linhas geradas à tabela
        }
        
        return $fieldDiv;
    }).call(this);
}

function generateShips(gameFieldManager) { // função de geração de navios
    gameFieldManager.putShipRandom(new BattleShip(1, ShipRotation.HORIZONTAL));
    gameFieldManager.putShipRandom(new BattleShip(1, ShipRotation.HORIZONTAL));
    gameFieldManager.putShipRandom(new BattleShip(1, ShipRotation.HORIZONTAL));
    gameFieldManager.putShipRandom(new BattleShip(1, ShipRotation.HORIZONTAL));
    gameFieldManager.putShipRandom(new BattleShip(2, getRandomInt(0, 1)));
    gameFieldManager.putShipRandom(new BattleShip(2, getRandomInt(0, 1)));
    gameFieldManager.putShipRandom(new BattleShip(2, getRandomInt(0, 1)));
    gameFieldManager.putShipRandom(new BattleShip(3, getRandomInt(0, 1)));
    gameFieldManager.putShipRandom(new BattleShip(3, getRandomInt(0, 1)));
    gameFieldManager.putShipRandom(new BattleShip(4, getRandomInt(0, 1)));
}

$.fn.makeGame = function (options) {
    // configurações do plug-in
    settings = $.extend({
        // o tamanho do campo de jogo (em células) por padrão
       fieldWidth: 10,
       fieldHeight: 10,
       computerWaitTime: 1000 // pausa entre movimentos do computador (em ms)
    }, options );
    
    this.empty(); // limpe a div em que vamos colocar o jogo
    
    var gameManager = new GameManager(this, prompt("Olá! Por favor, insira seu nome:")); // cria um objeto de controle do jogo, passa jQuert o objeto div e o nome do jogador solicitado na caixa de diálogo
    gameManager.startGame(); // comece o jogo
}

}(jQuery));