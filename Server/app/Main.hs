{-# LANGUAGE OverloadedStrings #-}

module Main where

import Control.Monad (forever)
import Control.Exception (finally)
import Control.Concurrent (MVar, newMVar, modifyMVar_, readMVar)
import qualified Data.Text as T
import Data.Text (Text)
import qualified Network.WebSockets as WS
import Network.Socket (withSocketsDo)

type Client = (Text, WS.Connection)
type ServerState = [Client]

newServerState :: ServerState
newServerState = []

-- Add a new client to the state
addClient :: Client -> ServerState -> ServerState
addClient client clients = client : clients

-- Remove a client from the state
removeClient :: Client -> ServerState -> ServerState
removeClient client = filter ((/= fst client) . fst)

-- Broadcast a message to all clients
broadcast :: Text -> ServerState -> IO ()
broadcast message clients = do
    putStrLn $ "Broadcasting: " ++ T.unpack message
    mapM_ (\(_, conn) -> WS.sendTextData conn message) clients

-- Application logic
application :: MVar ServerState -> WS.ServerApp
application state pending = do
    conn <- WS.acceptRequest pending
    WS.withPingThread conn 30 (return ()) $ do
        msg <- WS.receiveData conn
        let client = (msg, conn)
        clients <- readMVar state

        if clientExists client clients
        then WS.sendTextData conn ("User already exists" :: Text)
        else flip finally (disconnect client) $ do
            modifyMVar_ state $ \s -> do
                let s' = addClient client s
                WS.sendTextData conn $ "Welcome! Users: " <> T.intercalate ", " (map fst s)
                broadcast (fst client <> ":joined") s'
                return s'
            talk client state
  where
    disconnect client = do
        modifyMVar_ state $ \s -> do
            let s' = removeClient client s
            broadcast (fst client <> ":disconnected") s'
            return s'

-- Handle messages from clients
talk :: Client -> MVar ServerState -> IO ()
talk (user, conn) state = forever $ do
    msg <- WS.receiveData conn
    readMVar state >>= broadcast (user <> ":" <> msg)

-- Check if a client already exists (based on username)
clientExists :: Client -> ServerState -> Bool
clientExists client = any ((== fst client) . fst)

main :: IO ()
main = withSocketsDo $ do
    state <- newMVar newServerState
    WS.runServer "0.0.0.0" 9160 $ application state


