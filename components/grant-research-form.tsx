"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

export function GrantResearchForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    query: "",
    farmType: "",
    location: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.query) {
      toast({
        title: "Missing information",
        description: "Please provide a description of your farm or ranch.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Store form data in localStorage for use in the results page
      localStorage.setItem("grantResearchQuery", JSON.stringify({
        query: formData.query,
        farmType: formData.farmType,
        location: formData.location,
        timestamp: new Date().toISOString(),
      }));

      // Redirect to the grant research results page
      router.push("/grants");
    } catch (error) {
      console.error("Error starting grant research:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Agricultural Grant Research</CardTitle>
          <CardDescription>
            Find grants and financial assistance programs for your farm or ranch
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="query">Farm/Ranch Description</Label>
            <Textarea
              id="query"
              name="query"
              placeholder="Describe your farm or ranch in detail (size, operations, needs, challenges, future plans, etc.)"
              rows={6}
              value={formData.query}
              onChange={handleChange}
              required
            />
            <p className="text-sm text-muted-foreground">
              The more details you provide, the better we can find relevant grants
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="farmType">Farm/Ranch Type</Label>
            <Input
              id="farmType"
              name="farmType"
              placeholder="e.g., Dairy, Cattle, Organic Vegetables, Vineyard, etc."
              value={formData.farmType}
              onChange={handleChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              name="location"
              placeholder="e.g., California, TX, Midwest, etc."
              value={formData.location}
              onChange={handleChange}
            />
            <p className="text-sm text-muted-foreground">
              Many grants are location-specific, so providing your state or region helps find relevant opportunities
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button disabled={isLoading} type="submit" className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching for grants...
              </>
            ) : (
              "Find Agricultural Grants"
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
} 