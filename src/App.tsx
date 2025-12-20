import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import CreateTeam from "./pages/CreateTeam";
import Teams from "./pages/Teams";
import Requests from "./pages/Requests";
import TeamChat from "./pages/TeamChat";
import HackathonDetail from "./pages/HackathonDetail";
import Profile from "./pages/Profile";
import Friends from "./pages/Friends";
import FriendChat from "./pages/FriendChat";
import UserProfile from "./pages/UserProfile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/hackathon/:id" element={<HackathonDetail />} />
            <Route path="/hackathon/:hackathonId/team" element={<CreateTeam />} />
            <Route path="/teams" element={<Teams />} />
            <Route path="/requests" element={<Requests />} />
            <Route path="/team/:teamId/chat" element={<TeamChat />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/chat/:friendId" element={<FriendChat />} />
            <Route path="/user/:userid" element={<UserProfile />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
