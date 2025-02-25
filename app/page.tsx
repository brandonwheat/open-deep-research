'use client';

import Link from 'next/link';
import { Chat } from '@/components/chat/chat';
import { Header } from '@/components/chat/site-header';
import { GrantResearchForm } from '@/components/grant-research-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ResearchPage() {
  return (
    <main className="flex flex-col min-h-screen items-center p-4 bg-[#f6f6f3]">
      <Header />
      
      <div className="container max-w-5xl py-8">
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="general">General Research</TabsTrigger>
            <TabsTrigger value="grants">Agricultural Grants</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="mt-4">
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Deep Research Assistant</CardTitle>
                <CardDescription>
                  Ask any question and our AI will research the web for you
                </CardDescription>
              </CardHeader>
            </Card>
            <Chat id="research" initialMessages={[]} />
          </TabsContent>
          
          <TabsContent value="grants" className="mt-4">
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Agricultural Grant Finder</CardTitle>
                <CardDescription>
                  Find grants and funding opportunities for your farm or ranch, complete with application instructions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <GrantResearchForm />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
