import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const AuthCallback = () => {
  const navigate = useNavigate();
  const { refreshAccountType } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      const url = new URL(window.location.href);
      const error = url.searchParams.get("error");
      const code = url.searchParams.get("code");

      if (error) {
        navigate("/auth");
        return;
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(url.href);
        if (exchangeError) {
          navigate("/auth");
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("id", user.id)
        .single();

      const accountType = profile?.account_type ?? user.user_metadata?.account_type ?? null;

      if (!accountType) {
        navigate("/auth?onboarding=1");
        return;
      }

      await refreshAccountType(user.id);
      navigate(accountType === "supplier" ? "/supplier" : "/orders");
    };

    handleCallback();
  }, [navigate, refreshAccountType]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-sm">Finishing sign in...</span>
      </div>
    </div>
  );
};

export default AuthCallback;
